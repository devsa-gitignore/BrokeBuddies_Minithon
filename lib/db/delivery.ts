import type { SupabaseClient } from '@supabase/supabase-js'

export type DecisionEvent = {
  id: string
  item_id: string
  event_type: string
  scheduled_for: string
  status: string
  channel: string
  reason: string | null
  details: { interrupt?: boolean; breakThrough?: boolean; suppressedByBudget?: boolean }
  created_at: string
  title: string | null
  sender: string | null
  source: string | null
  category: string | null
}

type RawEvent = {
  id: string
  item_id: string
  event_type: string
  scheduled_for: string
  status: string
  channel: string
  reason: string | null
  details: DecisionEvent['details'] | null
  created_at: string
  items: { title: string | null; sender: string | null; source: string | null; category: string } | null
}

function mapRow(d: RawEvent): DecisionEvent {
  return {
    id: d.id,
    item_id: d.item_id,
    event_type: d.event_type,
    scheduled_for: d.scheduled_for,
    status: d.status,
    channel: d.channel,
    reason: d.reason,
    details: d.details ?? {},
    created_at: d.created_at,
    title: d.items?.title ?? null,
    sender: d.items?.sender ?? null,
    source: d.items?.source ?? null,
    category: d.items?.category ?? null,
  }
}

const SELECT = '*, items(title, sender, source, category)'

export async function fetchDecisionFeed(supabase: SupabaseClient, userId: string) {
  const nowIso = new Date().toISOString()
  const [upcomingQ, recentQ] = await Promise.all([
    supabase
      .from('delivery_events')
      .select(SELECT)
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(15),
    supabase
      .from('delivery_events')
      .select(SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40),
  ])
  if (upcomingQ.error) throw new Error('Could not load upcoming deliveries')
  if (recentQ.error) throw new Error('Could not load decision log')
  return {
    upcoming: (upcomingQ.data as RawEvent[]).map(mapRow),
    recent: (recentQ.data as RawEvent[]).map(mapRow),
  }
}
