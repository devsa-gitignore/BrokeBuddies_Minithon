import { BREAKING, CLUSTER } from '@/lib/config'
import { detectConflict, type ConflictResult } from '@/lib/conflict'
import { matchTerms } from '@/lib/scoring'
import type { ClusterRow, ItemRow, UserPrefs } from '@/types/domain'

const STOPWORDS = new Set(
  'the a an and or of to in on for with at by from as is are was were be been it its this that these those after before over into about new says say said will has have had not but than more amid how why what who when where'.split(' '),
)

export function tokenize(text: string | null | undefined): string[] {
  if (!text) return []
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
  return [...new Set(tokens)]
}

export function signatureOf(tokens: string[]): string {
  return tokens.slice(0, CLUSTER.maxSignatureTokens).sort().join(' ')
}

export function mergeSignature(signature: string | null, tokens: string[]): string {
  if (signature?.startsWith('hint:')) return signature
  const existing = signature ? signature.split(' ') : []
  return signatureOf([...new Set([...existing, ...tokens])])
}

/** Explicit hints are honoured first; otherwise token overlap on the title decides. */
export function matchCluster(
  item: { title: string | null; metadata: Record<string, unknown> },
  candidates: ClusterRow[],
): ClusterRow | null {
  const hint = typeof item.metadata.clusterHint === 'string' ? item.metadata.clusterHint : null
  if (hint) {
    return candidates.find((c) => c.signature === `hint:${hint}`) ?? null
  }
  const tokens = tokenize(item.title)
  if (tokens.length < CLUSTER.minOverlapTokens) return null
  let best: { cluster: ClusterRow; overlap: number } | null = null
  for (const c of candidates) {
    if (c.signature?.startsWith('hint:')) continue
    const sig = new Set((c.signature ?? '').split(' ').filter(Boolean))
    const overlap = tokens.filter((t) => sig.has(t)).length
    if (overlap >= CLUSTER.minOverlapTokens && overlap / tokens.length >= CLUSTER.minOverlapRatio) {
      if (!best || overlap > best.overlap) best = { cluster: c, overlap }
    }
  }
  return best?.cluster ?? null
}

export type ClusterMember = Pick<
  ItemRow,
  'id' | 'source' | 'timestamp' | 'title' | 'text' | 'metadata' | 'created_at'
>

export type ClusterStats = {
  sourceCount: number
  independentSourceCount: number
  independentInWindow: number
  spreadMinutes: number | null
  isBreaking: boolean
  topic: string | null
  firstSeenAt: Date
  lastSeenAt: Date
  conflict: ConflictResult
}

function memberTime(m: ClusterMember): number {
  return new Date(m.timestamp ?? m.created_at).getTime()
}

export function publisherKey(source: string) {
  return source.trim().toLowerCase()
}

/** Breaking needs BOTH a user topic match AND several independent sources in a short window. */
export function computeClusterStats(
  members: ClusterMember[],
  prefs: Pick<UserPrefs, 'topics' | 'keywords'>,
): ClusterStats {
  const publishers = new Map<string, number>()
  let first = Infinity
  let last = -Infinity
  for (const m of members) {
    const t = memberTime(m)
    first = Math.min(first, t)
    last = Math.max(last, t)
    const k = publisherKey(m.source)
    publishers.set(k, Math.min(publishers.get(k) ?? Infinity, t))
  }
  const windowStart = last - BREAKING.windowMinutes * 60_000
  const inWindow = [...publishers.values()].filter((t) => t >= windowStart)
  const windowTimes = inWindow.sort((a, b) => a - b)
  const spreadMinutes = windowTimes.length >= 2 ? (windowTimes[windowTimes.length - 1] - windowTimes[0]) / 60_000 : null

  let topic: string | null = null
  for (const m of members) {
    const hit = matchTerms(`${m.title ?? ''} ${m.text ?? ''}`, { topics: prefs.topics, keywords: [] }).topics[0]
    if (hit) {
      topic = hit
      break
    }
  }
  const isBreaking = !!topic && inWindow.length >= BREAKING.minIndependentSources

  return {
    sourceCount: members.length,
    independentSourceCount: publishers.size,
    independentInWindow: inWindow.length,
    spreadMinutes,
    isBreaking,
    topic,
    firstSeenAt: new Date(Number.isFinite(first) ? first : Date.now()),
    lastSeenAt: new Date(Number.isFinite(last) ? last : Date.now()),
    conflict: detectConflict(members),
  }
}
