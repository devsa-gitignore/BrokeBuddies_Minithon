import { NextResponse } from 'next/server'
import { apiError, handleError, parseBody, requireUser } from '@/lib/api'
import { generateWebhookToken, hashToken, tokenHint } from '@/lib/security/token'
import { createAdminClient } from '@/lib/supabase/admin'
import { connectionCreateSchema } from '@/lib/validation/schemas'

const COLUMNS =
  'id, user_id, source_type, name, status, enabled, token_hint, payload_mapping, config, last_received_at, events_received, last_error, last_error_category, last_error_at, created_at, updated_at'

export async function GET() {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)
  const { data, error } = await supabase.from('source_connections').select(COLUMNS).order('created_at', { ascending: true })
  if (error) return apiError('query_failed', 'Could not load connections', 500)
  return NextResponse.json({ connections: data })
}

export async function POST(req: Request) {
  try {
    const { user } = await requireUser()
    if (!user) return apiError('unauthorized', 'Sign in required', 401)
    const parsed = await parseBody(req, connectionCreateSchema)
    if ('response' in parsed) return parsed.response
    const { sourceType, name, payloadMapping, config } = parsed.data

    const isWebhook = sourceType === 'phone_notification'
    const isMock = sourceType.endsWith('_mock')
    const token = isWebhook ? generateWebhookToken() : null
    let admin: ReturnType<typeof createAdminClient>
    try {
      admin = createAdminClient()
    } catch (err) {
      console.error('[v0] admin client config error:', err instanceof Error ? err.message : 'unknown')
      return apiError('config_error', 'Server configuration error', 500)
    }
    const { data, error } = await admin
      .from('source_connections')
      .insert({
        user_id: user.id,
        source_type: sourceType,
        name: name ?? sourceType.replace(/_/g, ' '),
        status: isMock ? 'mock' : isWebhook ? 'not_configured' : sourceType === 'rss' ? 'connected' : 'not_configured',
        token_hash: token ? hashToken(token) : null,
        token_hint: token ? tokenHint(token) : null,
        payload_mapping: payloadMapping ?? {},
        config: config ?? {},
      })
      .select(COLUMNS)
      .single()
    if (error) return apiError('create_failed', 'Could not create connection', 500)
    // The token is returned exactly once and only its hash is stored.
    return NextResponse.json({ connection: data, token }, { status: 201 })
  } catch (e) {
    return handleError(e)
  }
}
