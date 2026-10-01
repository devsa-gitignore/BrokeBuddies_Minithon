import { NextResponse } from 'next/server'
import { apiError, requireUser } from '@/lib/api'
import { fetchClusters } from '@/lib/db/clusters'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)
  
  const searchParams = new URL(req.url).searchParams
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  try {
    const data = await fetchClusters(supabase, user.id, limit)
    return NextResponse.json(data)
  } catch (error) {
    return apiError('query_failed', 'Could not load clusters', 500)
  }
}
