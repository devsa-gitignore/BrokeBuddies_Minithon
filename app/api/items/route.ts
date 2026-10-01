import { NextResponse } from 'next/server'
import { apiError, requireUser } from '@/lib/api'
import { buildSourceTrail } from '@/lib/sourceTrail'
import { itemsQuerySchema } from '@/lib/validation/schemas'
import type { ClusterRow, ItemRow } from '@/types/domain'
import { fetchItems } from '@/lib/db/items'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)
  const q = itemsQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!q.success) return apiError('validation_failed', 'Invalid query', 400)
  const { category, sourceType, limit, includeLow } = q.data

  try {
    const { items, clusters } = await fetchItems(supabase, user.id, {
      category,
      sourceType,
      limit,
      includeLow: includeLow === 'true'
    })
    return NextResponse.json({ items, clusters })
  } catch (error) {
    return apiError('query_failed', 'Could not load items', 500)
  }
}
