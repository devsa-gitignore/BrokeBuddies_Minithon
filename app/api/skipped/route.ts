import { NextResponse } from 'next/server'
import { apiError, requireUser } from '@/lib/api'
import { fetchItems } from '@/lib/db/items'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)
  
  const searchParams = new URL(req.url).searchParams
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  try {
    const { items, clusters } = await fetchItems(supabase, user.id, {
      category: 'skipped',
      limit,
      includeLow: true,
      isDismissed: undefined
    })
    return NextResponse.json({ items, clusters })
  } catch (error) {
    return apiError('query_failed', 'Could not load items', 500)
  }
}
