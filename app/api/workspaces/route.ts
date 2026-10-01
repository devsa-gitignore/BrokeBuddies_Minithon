import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, apiError, parseBody, handleError } from '@/lib/api'
import type { CreateWorkspacePayload } from '@/types/workspace'

const CreateSchema = z.object({
  title: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  intent: z.enum(['teach_me', 'study_plan', 'research_deep', 'code_guide', 'custom']),
  intent_note: z.string().max(300).optional(),
  domain: z.enum(['research', 'code', 'study']),
})

export async function GET() {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return handleError(error)
  return NextResponse.json({ workspaces: data ?? [] })
}

export async function POST(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)

  const parsed = await parseBody<CreateWorkspacePayload>(req, CreateSchema)
  if ('response' in parsed) return parsed.response

  const { title, subject, intent, intent_note, domain } = parsed.data

  const { data, error } = await supabase
    .from('workspaces')
    .insert({
      user_id: user.id,
      title,
      subject,
      intent,
      intent_note: intent_note ?? null,
      domain,
    })
    .select('*')
    .single()

  if (error) return handleError(error)

  // Create empty notes row for this workspace
  await supabase.from('workspace_notes').insert({
    workspace_id: data.id,
    user_id: user.id,
    content: '',
  })

  return NextResponse.json({ workspace: data }, { status: 201 })
}
