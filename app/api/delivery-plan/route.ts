import { NextResponse } from 'next/server'
import { apiError, requireUser } from '@/lib/api'
import { fetchDecisionFeed } from '@/lib/db/delivery'
import { loadPrefs } from '@/lib/db/prefs'
import { activeHoldEnd, nextDigestAt } from '@/lib/attention'
import { localDayBounds } from '@/lib/timeZone'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)

  try {
    const prefs = await loadPrefs(supabase, user.id)
    const now = new Date()
    const { start, end } = localDayBounds(now, prefs.settings.timezone)
    const { count } = await supabase
      .from('delivery_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('details->>interrupt', 'true')
      .neq('status', 'cancelled')
      .gte('scheduled_for', start.toISOString())
      .lt('scheduled_for', end.toISOString())

    const feed = await fetchDecisionFeed(supabase, user.id)
    const hold = activeHoldEnd(now, prefs.settings)

    return NextResponse.json({
      ...feed,
      budget: { used: count ?? 0, limit: prefs.settings.interruption_budget },
      state: {
        mode: prefs.settings.current_mode,
        holdUntil: hold ? hold.toISOString() : null,
        nextDigest: nextDigestAt(now, prefs.settings).toISOString(),
        timezone: prefs.settings.timezone,
      },
    })
  } catch {
    return apiError('query_failed', 'Could not load delivery plan', 500)
  }
}
