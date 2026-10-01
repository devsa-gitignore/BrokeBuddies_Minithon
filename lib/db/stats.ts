import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchStats(supabase: SupabaseClient, userId: string, timezone: string) {
  // We'll fetch basic counts and aggregates.
  const [
    { count: totalReceived },
    { count: totalClusters },
    { data: categoryData },
    { data: sourceData },
    { data: eventData },
  ] = await Promise.all([
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('clusters').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    // Aggregate by category
    supabase.rpc('count_items_by_category', { uid: userId }).catch(() => null), // Fallback if RPC doesn't exist
    // Aggregate by source
    supabase.rpc('count_items_by_source', { uid: userId }).catch(() => null),
    // Interruption budget
    supabase.from('delivery_events')
      .select('details')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      // Note: A real app would filter by today's bounds
  ])

  // If RPCs are not available, we could do it in-memory for the prototype by fetching all items
  let categoryBreakdown = categoryData
  let sourceDistribution = sourceData
  let totalUnique = totalReceived // Simplification

  if (!categoryBreakdown || !sourceDistribution) {
    const { data: allItems } = await supabase.from('items').select('category, source, dedupe_key').eq('user_id', userId)
    
    const catMap: Record<string, number> = { people: 0, urgent: 0, summaries: 0, for_you: 0, skipped: 0 }
    const srcMap: Record<string, number> = {}
    const dedupeSet = new Set<string>()
    
    if (allItems) {
      for (const item of allItems) {
        catMap[item.category] = (catMap[item.category] || 0) + 1
        srcMap[item.source] = (srcMap[item.source] || 0) + 1
        dedupeSet.add(item.dedupe_key)
      }
    }
    
    totalUnique = dedupeSet.size
    categoryBreakdown = catMap
    sourceDistribution = srcMap
  }

  // Calculate interruptions
  const interruptions = (eventData || []).filter(e => e.details?.interrupt === true).length

  return {
    total_received: totalReceived || 0,
    total_unique: totalUnique || 0,
    total_clusters: totalClusters || 0,
    people_count: categoryBreakdown?.people || 0,
    urgent_count: categoryBreakdown?.urgent || 0,
    summary_count: categoryBreakdown?.summaries || 0,
    for_you_count: categoryBreakdown?.for_you || 0,
    skipped_count: categoryBreakdown?.skipped || 0,
    source_distribution: sourceDistribution || {},
    attention_load_by_hour: {}, // Placeholder
    interruption_budget_used: interruptions,
  }
}
