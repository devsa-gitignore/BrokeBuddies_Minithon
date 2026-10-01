import type { SupabaseClient } from '@supabase/supabase-js'
import { CLUSTER, CLUSTERABLE_SOURCE_TYPES, PROCESSING_VERSION, REPEAT } from '@/lib/config'
import { computeClusterStats, matchCluster, mergeSignature, signatureOf, tokenize, type ClusterMember } from '@/lib/clustering'
import { loadPrefs } from '@/lib/db/prefs'
import { evaluateItem, type EvalCluster, type EvalResult } from '@/lib/evaluation'
import { localDayBounds } from '@/lib/timeZone'
import type { ClusterRow, ItemRow, NormalizedItem, UserPrefs } from '@/types/domain'

export type IngestOutcome =
  | { status: 'created'; itemId: string; category: string }
  | { status: 'duplicate'; itemId: string }

function evalColumns(ev: EvalResult) {
  return {
    category: ev.categorization.category,
    people_kind: ev.categorization.peopleKind,
    is_low_priority: ev.categorization.isLowPriority,
    relevance_score: ev.scores.relevance,
    urgency_score: ev.scores.urgency,
    sender_weight: ev.scores.sender,
    novelty_score: ev.scores.novelty,
    context_score: ev.scores.context,
    importance_score: ev.scores.importance,
    score_breakdown: ev.scores.breakdown,
    why: ev.why,
    act_by: ev.actBy?.toISOString() ?? null,
    act_by_confidence: ev.actByConfidence,
    urgency_evidence: ev.urgencyEvidence,
    is_overdue: ev.isOverdue,
    notify_at: ev.plan.notifyAt?.toISOString() ?? null,
    processing_version: PROCESSING_VERSION,
    processing_status: 'processed',
    processing_error: null,
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

async function countInterruptsToday(db: SupabaseClient, userId: string, prefs: UserPrefs, now: Date) {
  const { start, end } = localDayBounds(now, prefs.settings.timezone)
  const { count } = await db
    .from('delivery_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('details->>interrupt', 'true')
    .neq('status', 'cancelled')
    .gte('scheduled_for', start.toISOString())
    .lt('scheduled_for', end.toISOString())
  return count ?? 0
}

async function writeDelivery(db: SupabaseClient, userId: string, itemId: string, clusterId: string | null, ev: EvalResult, now: Date) {
  const plan = ev.plan
  await db
    .from('delivery_events')
    .update({ status: 'cancelled', reason: 'Superseded by re-evaluation' })
    .eq('item_id', itemId)
    .eq('status', 'scheduled')
    .neq('event_type', plan.eventType ?? '__none__')
  if (plan.type === 'none' || !plan.eventType || !plan.notifyAt) return
  await db.from('delivery_events').upsert(
    {
      user_id: userId,
      item_id: itemId,
      cluster_id: clusterId,
      event_type: plan.eventType,
      scheduled_for: plan.notifyAt.toISOString(),
      status: 'scheduled',
      channel: 'web',
      reason: plan.reason,
      details: {
        interrupt: plan.type === 'interrupt',
        breakThrough: plan.breakThrough,
        suppressedByBudget: plan.suppressedByBudget,
        evaluatedAt: now.toISOString(),
      },
    },
    { onConflict: 'item_id,event_type', ignoreDuplicates: false },
  )
}

function toEvalCluster(c: ClusterRow | null, stats: ReturnType<typeof computeClusterStats> | null, isNew: boolean): EvalCluster | null {
  if (!c || !stats) return null
  return {
    id: c.id,
    sourceCount: stats.sourceCount,
    independentSourceCount: stats.independentSourceCount,
    hasConflict: stats.conflict.hasConflict,
    isBreaking: stats.isBreaking,
    isNew,
    topic: stats.topic,
    spreadMinutes: stats.spreadMinutes,
  }
}

/** Recomputes cluster stats and re-scores every member; safe to call repeatedly. */
export async function refreshCluster(db: SupabaseClient, userId: string, clusterId: string, prefs: UserPrefs, now: Date) {
  const { data: members } = await db.from('items').select('*').eq('user_id', userId).eq('cluster_id', clusterId)
  const rows = (members ?? []) as ItemRow[]
  if (!rows.length) return
  const stats = computeClusterStats(rows as ClusterMember[], prefs)
  const { data: cluster } = await db.from('clusters').select('*').eq('id', clusterId).eq('user_id', userId).single()
  if (!cluster) return
  const top = Math.max(...rows.map((r) => r.importance_score), 0)
  await db
    .from('clusters')
    .update({
      source_count: stats.sourceCount,
      independent_source_count: stats.independentSourceCount,
      has_conflict: stats.conflict.hasConflict,
      is_breaking: stats.isBreaking,
      topic: stats.topic,
      first_seen_at: stats.firstSeenAt.toISOString(),
      last_seen_at: stats.lastSeenAt.toISOString(),
      importance_score: top,
      updated_at: now.toISOString(),
    })
    .eq('id', clusterId)
    .eq('user_id', userId)

  let interrupts = await countInterruptsToday(db, userId, prefs, now)
  for (const row of rows) {
    const ev = evaluateItem({
      item: {
        sourceType: row.source_type,
        source: row.source,
        sender: row.sender,
        senderIdentifier: row.sender_identifier,
        title: row.title,
        text: row.text,
        url: row.url,
        metadata: row.metadata,
      },
      prefs,
      now,
      cluster: toEvalCluster(cluster as ClusterRow, stats, false),
      repeatCount: 1,
      interruptsToday: interrupts,
    })
    await db.from('items').update(evalColumns(ev)).eq('id', row.id).eq('user_id', userId)
    await writeDelivery(db, userId, row.id, clusterId, ev, now)
    if (ev.plan.type === 'interrupt' && row.category !== 'urgent') interrupts += 1
  }
}

/** Promotes earlier ordinary notifications from the same sender once the repeat threshold is met. */
async function promoteRepeats(db: SupabaseClient, userId: string, senderKey: string, since: Date, count: number) {
  await db
    .from('items')
    .update({
      people_kind: 'repeat',
      sender_weight: 8,
      why: `${count} contacts from the same sender within ${REPEAT.windowMinutes} minutes.`,
    })
    .eq('user_id', userId)
    .eq('source_type', 'phone_notification')
    .eq('metadata->>senderKey', senderKey)
    .eq('people_kind', 'ordinary')
    .gte('timestamp', since.toISOString())
}

export async function processItem(
  db: SupabaseClient,
  userId: string,
  norm: NormalizedItem,
  opts: { connectionId?: string | null; isMock?: boolean; now?: Date; prefs?: UserPrefs } = {},
): Promise<IngestOutcome> {
  const now = opts.now ?? new Date()
  const { data: existing } = await db.from('items').select('id').eq('user_id', userId).eq('dedupe_key', norm.dedupeKey).maybeSingle()
  if (existing) return { status: 'duplicate', itemId: existing.id }

  const prefs = opts.prefs ?? (await loadPrefs(db, userId))

  let repeatCount = 1
  const itemTime = norm.timestamp ?? now
  if (norm.sourceType === 'phone_notification' && norm.senderKey) {
    const since = new Date(itemTime.getTime() - REPEAT.windowMinutes * 60_000)
    const { count } = await db
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source_type', 'phone_notification')
      .eq('metadata->>senderKey', norm.senderKey)
      .gte('timestamp', since.toISOString())
      .lte('timestamp', itemTime.toISOString())
    repeatCount = (count ?? 0) + 1
    if (repeatCount >= REPEAT.minEvents) await promoteRepeats(db, userId, norm.senderKey, since, repeatCount)
  }

  let cluster: ClusterRow | null = null
  let clusterIsNew = false
  let stats: ReturnType<typeof computeClusterStats> | null = null
  const clusterable = CLUSTERABLE_SOURCE_TYPES.includes(norm.sourceType)
  const hint = typeof norm.metadata.clusterHint === 'string' ? norm.metadata.clusterHint : null

  if (clusterable) {
    const lookback = new Date(now.getTime() - CLUSTER.lookbackHours * 3600_000).toISOString()
    const { data: candidates } = await db.from('clusters').select('*').eq('user_id', userId).gte('last_seen_at', lookback)
    cluster = matchCluster({ title: norm.title, metadata: norm.metadata }, (candidates ?? []) as ClusterRow[])
    const tokens = tokenize(norm.title)
    if (!cluster) {
      const { data: created, error } = await db
        .from('clusters')
        .insert({
          user_id: userId,
          title: norm.title ?? norm.text?.slice(0, 120) ?? 'Untitled',
          signature: hint ? `hint:${hint}` : signatureOf(tokens),
          first_seen_at: itemTime.toISOString(),
          last_seen_at: itemTime.toISOString(),
        })
        .select('*')
        .single()
      if (error || !created) throw new Error('cluster_insert_failed')
      cluster = created as ClusterRow
      clusterIsNew = true
    } else {
      await db.from('clusters').update({ signature: mergeSignature(cluster.signature, tokens) }).eq('id', cluster.id).eq('user_id', userId)
    }
    const { data: members } = await db.from('items').select('id, source, timestamp, title, text, metadata, created_at').eq('user_id', userId).eq('cluster_id', cluster.id)
    const pseudo = {
      id: 'pending',
      source: norm.source,
      timestamp: itemTime.toISOString(),
      title: norm.title,
      text: norm.text,
      metadata: norm.metadata,
      created_at: now.toISOString(),
    }
    stats = computeClusterStats([...((members ?? []) as ClusterMember[]), pseudo], prefs)
  }

  const interrupts = await countInterruptsToday(db, userId, prefs, now)
  const ev = evaluateItem({
    item: {
      sourceType: norm.sourceType,
      source: norm.source,
      sender: norm.sender,
      senderIdentifier: norm.senderIdentifier,
      title: norm.title,
      text: norm.text,
      url: norm.url,
      metadata: norm.metadata,
    },
    prefs,
    now,
    cluster: toEvalCluster(cluster, stats, clusterIsNew),
    repeatCount,
    interruptsToday: interrupts,
  })

  const { data: inserted, error } = await db
    .from('items')
    .insert({
      user_id: userId,
      source_connection_id: opts.connectionId ?? null,
      external_id: norm.externalId,
      source: norm.source,
      source_type: norm.sourceType,
      sender: norm.sender,
      sender_identifier: norm.senderIdentifier,
      timestamp: norm.timestamp?.toISOString() ?? null,
      title: norm.title,
      text: norm.text,
      url: norm.url,
      is_mock: opts.isMock ?? norm.sourceType.endsWith('_mock'),
      cluster_id: cluster?.id ?? null,
      content_hash: norm.contentHash,
      dedupe_key: norm.dedupeKey,
      engagement: norm.engagement,
      metadata: norm.metadata,
      ...evalColumns(ev),
    })
    .select('id, category')
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: again } = await db.from('items').select('id').eq('user_id', userId).eq('dedupe_key', norm.dedupeKey).single()
      return { status: 'duplicate', itemId: again?.id ?? '' }
    }
    throw new Error(`item_insert_failed:${error.code}`)
  }

  await writeDelivery(db, userId, inserted.id, cluster?.id ?? null, ev, now)
  if (cluster) await refreshCluster(db, userId, cluster.id, prefs, now)
  return { status: 'created', itemId: inserted.id, category: inserted.category }
}

/** Re-runs the full evaluation for every stored item, e.g. after settings change. */
export async function reevaluateAll(db: SupabaseClient, userId: string, now = new Date()) {
  const prefs = await loadPrefs(db, userId)
  const { data: clusters } = await db.from('clusters').select('id').eq('user_id', userId)
  const clustered = new Set<string>()
  for (const c of clusters ?? []) {
    await refreshCluster(db, userId, c.id, prefs, now)
    clustered.add(c.id)
  }
  const { data: rows } = await db.from('items').select('*').eq('user_id', userId).is('cluster_id', null).order('timestamp', { ascending: true }).limit(1000)
  let interrupts = await countInterruptsToday(db, userId, prefs, now)
  for (const row of (rows ?? []) as ItemRow[]) {
    let repeat = 1
    if (row.source_type === 'phone_notification') repeat = row.people_kind === 'repeat' ? REPEAT.minEvents : 1
    const ev = evaluateItem({
      item: {
        sourceType: row.source_type,
        source: row.source,
        sender: row.sender,
        senderIdentifier: row.sender_identifier,
        title: row.title,
        text: row.text,
        url: row.url,
        metadata: row.metadata,
      },
      prefs,
      now,
      cluster: null,
      repeatCount: repeat,
      interruptsToday: interrupts,
    })
    await db.from('items').update(evalColumns(ev)).eq('id', row.id).eq('user_id', userId)
    await writeDelivery(db, userId, row.id, null, ev, now)
    if (ev.plan.type === 'interrupt') interrupts += 1
  }
}
