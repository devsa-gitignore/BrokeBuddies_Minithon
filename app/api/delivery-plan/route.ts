import { NextResponse } from 'next/server'
import { apiError, requireUser } from '@/lib/api'
import { fetchDeliveryPlan } from '@/lib/db/delivery'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)
  
  try {
    const data = await fetchDeliveryPlan(supabase, user.id)
    return NextResponse.json(data)
  } catch (error) {
    return apiError('query_failed', 'Could not load delivery plan', 500)
  }
}
