import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ValidationError } from '@/lib/normalizer'

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null as null }
  return { supabase, user }
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return { response: apiError('invalid_json', 'Request body must be valid JSON', 400) }
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { response: apiError('validation_failed', `${first.path.join('.') || 'body'}: ${first.message}`, 400) }
  }
  return { data: parsed.data }
}

export function handleError(err: unknown) {
  if (err instanceof ValidationError) return apiError(err.code, err.message, err.status)
  console.error('[v0] unhandled api error:', err instanceof Error ? err.message : 'unknown')
  return apiError('internal_error', 'Something went wrong', 500)
}
