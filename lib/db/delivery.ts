import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchDeliveryPlan(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('delivery_events')
    .select('*, items(category)')
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .order('scheduled_for', { ascending: true })

  if (error) throw new Error('Could not load delivery plan')

  const deliveries = (data ?? []).map(d => ({
    item_id: d.item_id,
    scheduled_for: d.scheduled_for,
    reason: d.reason,
    channel: d.channel,
    category: (d.items as any)?.category ?? 'unknown',
  }))

  return { deliveries }
}
