import { NextResponse } from 'next/server'
import { apiError, requireUser } from '@/lib/api'
import { fetchClusterById } from '@/lib/db/clusters'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)
  
  const id = (await params).id

  try {
    const data = await fetchClusterById(supabase, user.id, id)
    return NextResponse.json(data)
  } catch (error) {
    return apiError('not_found', 'Cluster not found', 404)
  }
}
