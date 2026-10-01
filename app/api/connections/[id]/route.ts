import { NextResponse } from 'next/server'
import { apiError, handleError, parseBody, requireUser } from '@/lib/api'
import { generateWebhookToken, hashToken, tokenHint } from '@/lib/security/token'
import { createAdminClient } from '@/lib/supabase/admin'
import { connectionPatchSchema, uuidSchema } from '@/lib/validation/schemas'

type Ctx = { params: Promise<{ id: string }> }

async function ownedConnection(id: string, userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('source_connections')
    .select('id, source_type')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  return { admin, conn: data }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const { user } = await requireUser()
    if (!user) return apiError('unauthorized', 'Sign in required', 401)
    if (!uuidSchema.safeParse(id).success) return apiError('invalid_id', 'Invalid id', 400)
    const parsed = await parseBody(req, connectionPatchSchema)
    if ('response' in parsed) return parsed.response
    const { admin, conn } = await ownedConnection(id, user.id)
    if (!conn) return apiError('not_found', 'Connection not found', 404)
    const p = parsed.data
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (p.name !== undefined) update.name = p.name
    if (p.enabled !== undefined) {
      update.enabled = p.enabled
      if (!p.enabled) update.status = 'disabled'
    }
    if (p.payloadMapping !== undefined) update.payload_mapping = p.payloadMapping
    if (p.config !== undefined) update.config = p.config
    const { error } = await admin.from('source_connections').update(update).eq('id', id).eq('user_id', user.id)
    if (error) return apiError('update_failed', 'Could not update connection', 500)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e)
  }
}

/** POST rotates the webhook token; the previous token stops working immediately. */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const { user } = await requireUser()
    if (!user) return apiError('unauthorized', 'Sign in required', 401)
    if (!uuidSchema.safeParse(id).success) return apiError('invalid_id', 'Invalid id', 400)
    const { admin, conn } = await ownedConnection(id, user.id)
    if (!conn || conn.source_type !== 'phone_notification') return apiError('not_found', 'Connection not found', 404)
    const token = generateWebhookToken()
    const { error } = await admin
      .from('source_connections')
      .update({ token_hash: hashToken(token), token_hint: tokenHint(token), enabled: true, status: 'not_configured', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return apiError('rotate_failed', 'Could not rotate token', 500)
    return NextResponse.json({ token })
  } catch (e) {
    return handleError(e)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const { user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)
  if (!uuidSchema.safeParse(id).success) return apiError('invalid_id', 'Invalid id', 400)
  const { admin } = await ownedConnection(id, user.id)
  await admin.from('source_connections').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
