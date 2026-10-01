import { NextResponse } from 'next/server'
import { apiError, handleError, parseBody, requireUser } from '@/lib/api'
import { applySettingsPatch } from '@/lib/db/settings'
import { onboardingSchema } from '@/lib/validation/schemas'

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser()
    if (!user) return apiError('unauthorized', 'Sign in required', 401)
    const parsed = await parseBody(req, onboardingSchema)
    if ('response' in parsed) return parsed.response
    const { displayName, purpose, sourcesUsed, settings, calibration } = parsed.data

    await applySettingsPatch(supabase, user.id, settings)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...(displayName ? { display_name: displayName } : {}),
        sources_used: sourcesUsed,
        onboarding_completed: true,
        onboarding_version: 2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      
    if (profileError) {
      console.error('Profile update error:', profileError)
      throw profileError
    }
    if (calibration.length) {
      const { error: calibError } = await supabase.from('feedback').insert(
        calibration.map((c) => ({
          user_id: user.id,
          item_id: null,
          action: c.important ? 'calibration_important' : 'calibration_not_important',
          note: c.key,
        })),
      )
      if (calibError) {
        console.error('Calibration insert error:', calibError)
        throw calibError
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e)
  }
}
