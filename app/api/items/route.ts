import { NextResponse } from 'next/server'
import { apiError, requireUser } from '@/lib/api'
import { buildSourceTrail } from '@/lib/sourceTrail'
import { itemsQuerySchema } from '@/lib/validation/schemas'
import type { ClusterRow, ItemRow } from '@/types/domain'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)
  const q = itemsQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!q.success) return apiError('validation_failed', 'Invalid query', 400)
  const { category, limit, includeLow } = q.data

  let query = supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_dismissed', false)
    .order('importance_score', { ascending: false })
    .order('timestamp', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (category) query = query.eq('category', category)
  if (includeLow === 'false') query = query.eq('is_low_priority', false)
  const { data, error } = await query
  if (error) return apiError('query_failed', 'Could not load items', 500)
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

  return NextResponse.json({ items, clusters })
}
