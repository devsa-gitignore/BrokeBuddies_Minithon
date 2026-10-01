import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSourceTrail } from '@/lib/sourceTrail'
import type { ClusterRow, ItemRow } from '@/types/domain'

export async function fetchClusters(supabase: SupabaseClient, userId: string, limit = 50) {
  const { data: clustersData, error } = await supabase
    .from('clusters')
    .select('*')
    .eq('user_id', userId)
    .order('importance_score', { ascending: false })
    .order('last_seen_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error('Could not load clusters')
  const clusters = (clustersData ?? []) as ClusterRow[]
  
  if (!clusters.length) return { clusters: {}, items: [] }

  const clusterIds = clusters.map(c => c.id)
  
  const [{ data: members }, { data: summaries }] = await Promise.all([
    supabase.from('items').select('*').in('cluster_id', clusterIds),
    supabase.from('cluster_summaries').select('*').in('cluster_id', clusterIds).order('version', { ascending: false }),
  ])
  
  const items = (members ?? []) as ItemRow[]
  const enrichedClusters: Record<string, ClusterRow & { trail: ReturnType<typeof buildSourceTrail>; summary: unknown }> = {}
  
  for (const c of clusters) {
    const m = items.filter((x) => x.cluster_id === c.id)
    enrichedClusters[c.id] = {
      ...c,
      trail: buildSourceTrail(m as never),
      summary: (summaries ?? []).find((s) => s.cluster_id === c.id) ?? null,
    }
  }

  return { clusters: enrichedClusters, items }
}

export async function fetchClusterById(supabase: SupabaseClient, userId: string, clusterId: string) {
  const { data: clusterData, error } = await supabase
    .from('clusters')
    .select('*')
    .eq('user_id', userId)
    .eq('id', clusterId)
    .single()

  if (error || !clusterData) throw new Error('Cluster not found')
  const cluster = clusterData as ClusterRow
  
  const [{ data: members }, { data: summaries }] = await Promise.all([
    supabase.from('items').select('*').eq('cluster_id', clusterId).order('timestamp', { ascending: true }),
    supabase.from('cluster_summaries').select('*').eq('cluster_id', clusterId).order('version', { ascending: false }),
  ])
  
  const items = (members ?? []) as ItemRow[]
  
  const enrichedCluster = {
    ...cluster,
    trail: buildSourceTrail(items as never),
    summary: (summaries ?? [])[0] ?? null,
  }

  return { cluster: enrichedCluster, items }
}
