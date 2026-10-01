import { NextResponse } from 'next/server'
import { apiError, requireUser } from '@/lib/api'
import { fetchStats } from '@/lib/db/stats'
import { loadPrefs } from '@/lib/db/prefs'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)
  
  try {
    const prefs = await loadPrefs(supabase, user.id)
    const stats = await fetchStats(supabase, user.id, prefs.settings.timezone)
    return NextResponse.json(stats)
  } catch (error) {
    return apiError('query_failed', 'Could not load stats', 500)
  }
}
