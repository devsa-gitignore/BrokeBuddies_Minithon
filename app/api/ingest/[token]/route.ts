import { NextResponse } from 'next/server'
import { adaptPhonePayload } from '@/lib/adapters/phoneNotification'
import { LIMITS, RATE_LIMIT_PER_MINUTE } from '@/lib/config'
import { normalizeRawItem, ValidationError } from '@/lib/normalizer'
import { processItem } from '@/lib/pipeline'
import { hashToken, isPlausibleToken } from '@/lib/security/token'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // Uniform response for any bad token so valid tokens cannot be probed.
  if (!isPlausibleToken(token)) return fail('invalid_token', 'Invalid token', 401)

  let db: ReturnType<typeof createAdminClient>
  try {
    db = createAdminClient()
  } catch (err) {
    console.error('[v0] admin client config error:', err instanceof Error ? err.message : 'unknown')
    return fail('config_error', 'Server configuration error', 500)
  }
  const { data: conn } = await db
    .from('source_connections')
    .select('id, user_id, source_type, enabled, payload_mapping, status')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (!conn || !conn.enabled) return fail('invalid_token', 'Invalid token', 401)

  const logEvent = (status: string, http: number, category: string | null, itemId?: string) =>
    db.from('ingestion_events').insert({
      user_id: conn.user_id,
      source_connection_id: conn.id,
      status,
      http_status: http,
      error_category: category,
      item_id: itemId ?? null,
      details: { sourceType: conn.source_type },
    })

  const recordError = async (category: string) => {
    await db
      .from('source_connections')
      .update({ status: 'error', last_error: category, last_error_category: category, last_error_at: new Date().toISOString() })
      .eq('id', conn.id)
  }

  const { data: allowed, error: rlError } = await db.rpc('check_webhook_rate_limit', { p_connection: conn.id, p_limit: RATE_LIMIT_PER_MINUTE })
  if (rlError || allowed === false) {
    if (rlError) console.error('[v0] rate limit RPC failed:', rlError)
    await logEvent('rejected', 429, 'rate_limited')
    return fail('rate_limited', 'Too many requests', 429)
  }

  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > LIMITS.webhookBodyBytes) {
    await logEvent('rejected', 413, 'payload_too_large')
    return fail('payload_too_large', 'Payload too large', 413)
  }
  const raw = await req.text()
  if (raw.length > LIMITS.webhookBodyBytes) {
    await logEvent('rejected', 413, 'payload_too_large')
    return fail('payload_too_large', 'Payload too large', 413)
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    await logEvent('rejected', 400, 'invalid_json')
    await recordError('invalid_json')
    return fail('invalid_json', 'Body must be valid JSON', 400)
  }

  try {
    const receivedAt = new Date()
    const rawItem = adaptPhonePayload(payload, (conn.payload_mapping ?? {}) as Record<string, string>, receivedAt)
    const norm = normalizeRawItem(rawItem, { connectionId: conn.id, now: receivedAt })
    const outcome = await processItem(db, conn.user_id, norm, { connectionId: conn.id, now: receivedAt })

    await db
      .from('source_connections')
      .update({
        status: 'live',
        last_received_at: receivedAt.toISOString(),
        events_received: (await db.from('ingestion_events').select('id', { count: 'exact', head: true }).eq('source_connection_id', conn.id).eq('status', 'accepted')).count! + 1,
        last_error: null,
        last_error_category: null,
        updated_at: receivedAt.toISOString(),
      })
      .eq('id', conn.id)
    await logEvent(outcome.status === 'created' ? 'accepted' : 'duplicate', outcome.status === 'created' ? 201 : 200, null, outcome.itemId)
    return NextResponse.json({ ok: true, status: outcome.status }, { status: outcome.status === 'created' ? 201 : 200 })
  } catch (err) {
    if (err instanceof ValidationError) {
      await logEvent('rejected', err.status, err.code)
      await recordError(err.code)
      return fail(err.code, err.message, err.status)
    }
    console.error('[v0] ingest failure:', err instanceof Error ? err.message : 'unknown')
    await logEvent('error', 500, 'processing_failed')
    await recordError('processing_failed')
    return fail('processing_failed', 'Could not process notification', 500)
  }
}
