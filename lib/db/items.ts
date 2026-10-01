import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSourceTrail } from '@/lib/sourceTrail'
import type { ClusterRow, ItemRow } from '@/types/domain'

export async function fetchItems(
  supabase: SupabaseClient, 
  userId: string, 
  options: { category?: string; sourceType?: string; limit?: number; includeLow?: boolean; isDismissed?: boolean } = {}
) {
  const { category, sourceType, limit = 50, includeLow = false, isDismissed = false } = options

  let query = supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .order('importance_score', { ascending: false })
    .order('timestamp', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (category) query = query.eq('category', category)
  if (sourceType) query = query.eq('source_type', sourceType)
  if (!includeLow) query = query.eq('is_low_priority', false)
  if (isDismissed !== undefined) query = query.eq('is_dismissed', isDismissed)

  const { data, error } = await query
  if (error) throw new Error('Could not load items')
  const items = (data ?? []) as ItemRow[]

  const clusterIds = [...new Set(items.map((i) => i.cluster_id).filter((x): x is string => !!x))]
  const clusters: Record<string, ClusterRow & { trail: ReturnType<typeof buildSourceTrail>; summary: unknown }> = {}
  
  if (clusterIds.length) {
    const [{ data: cl }, { data: members }, { data: summaries }] = await Promise.all([
      supabase.from('clusters').select('*').in('id', clusterIds),
      supabase.from('items').select('id, source, source_type, timestamp, url, title, is_mock, created_at, cluster_id').in('cluster_id', clusterIds),
      supabase.from('cluster_summaries').select('*').in('cluster_id', clusterIds).order('version', { ascending: false }),
    ])
    for (const c of (cl ?? []) as ClusterRow[]) {
      const m = (members ?? []).filter((x) => x.cluster_id === c.id)
      clusters[c.id] = {
        ...c,
        trail: buildSourceTrail(m as never),
        summary: (summaries ?? []).find((s) => s.cluster_id === c.id) ?? null,
      }
    }
  }

  return { items, clusters }
}
