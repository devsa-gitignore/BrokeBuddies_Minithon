import { NextResponse } from 'next/server'
import { apiError, handleError, parseBody, requireUser } from '@/lib/api'
import { applySettingsPatch } from '@/lib/db/settings'
import { loadPrefs } from '@/lib/db/prefs'
import { reevaluateAll } from '@/lib/pipeline'
import { createAdminClient } from '@/lib/supabase/admin'
import { settingsPatchSchema } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)
  const prefs = await loadPrefs(supabase, user.id)
  const { data: profile } = await supabase.from('profiles').select('display_name, onboarding_completed, sources_used').eq('id', user.id).maybeSingle()
  return NextResponse.json({ prefs, profile })
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user } = await requireUser()
    if (!user) return apiError('unauthorized', 'Sign in required', 401)
    const parsed = await parseBody(req, settingsPatchSchema)
    if ('response' in parsed) return parsed.response
    await applySettingsPatch(supabase, user.id, parsed.data)
    await reevaluateAll(createAdminClient(), user.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e)
  }
}
