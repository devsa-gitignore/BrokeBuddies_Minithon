import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, apiError, parseBody, handleError } from '@/lib/api'

const NotesSchema = z.object({ content: z.string().max(50000) })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)
  const { id } = await params

  const { data: ws } = await supabase.from('workspaces').select('id').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!ws) return apiError('not_found', 'Workspace not found', 404)

  const { data } = await supabase.from('workspace_notes').select('*').eq('workspace_id', id).maybeSingle()
  return NextResponse.json({ notes: data ?? { content: '' } })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)
  const { id } = await params

  const { data: ws } = await supabase.from('workspaces').select('id').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!ws) return apiError('not_found', 'Workspace not found', 404)

  const parsed = await parseBody(req, NotesSchema)
  if ('response' in parsed) return parsed.response

  const { data: existing } = await supabase.from('workspace_notes').select('id').eq('workspace_id', id).maybeSingle()

  if (existing) {
    const { error } = await supabase.from('workspace_notes')
      .update({ content: parsed.data.content, updated_at: new Date().toISOString() })
      .eq('workspace_id', id).eq('user_id', user.id)
    if (error) return handleError(error)
  } else {
    await supabase.from('workspace_notes').insert({
      workspace_id: id,
      user_id: user.id,
      content: parsed.data.content,
    })
  }

  return NextResponse.json({ saved: true })
}
