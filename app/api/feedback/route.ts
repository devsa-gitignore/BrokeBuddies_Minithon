import { NextResponse } from 'next/server'
import { apiError, handleError, parseBody, requireUser } from '@/lib/api'
import { feedbackSchema } from '@/lib/validation/schemas'

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser()
    if (!user) return apiError('unauthorized', 'Sign in required', 401)
    const parsed = await parseBody(req, feedbackSchema)
    if ('response' in parsed) return parsed.response
    const { itemId, action, note } = parsed.data

    const { error } = await supabase
      .from('feedback')
      .insert({ user_id: user.id, item_id: itemId ?? null, action, note: note ?? null })
    if (error) return apiError('feedback_failed', 'Could not record feedback', 400)

    if (itemId && (action === 'read' || action === 'dismiss')) {
      await supabase
        .from('items')
        .update(action === 'read' ? { is_read: true } : { is_dismissed: true })
        .eq('id', itemId)
        .eq('user_id', user.id)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e)
  }
}
