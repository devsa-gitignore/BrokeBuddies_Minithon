import { NextResponse } from 'next/server'
import { apiError, handleError, requireUser } from '@/lib/api'
import { seedMockData } from '@/lib/mock/seed'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

export async function POST() {
  try {
    const { user } = await requireUser()
    if (!user) return apiError('unauthorized', 'Sign in required', 401)
    const counts = await seedMockData(createAdminClient(), user.id)
    return NextResponse.json({ ok: true, ...counts })
  } catch (e) {
    return handleError(e)
  }
}

export async function DELETE() {
  const { user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)
  const admin = createAdminClient()
  await admin.from('items').delete().eq('user_id', user.id).eq('is_mock', true)
  await admin.from('clusters').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
