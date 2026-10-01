import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, apiError, parseBody, handleError } from '@/lib/api'
import { streamWorkspaceChat } from '@/lib/workspaces/chat'
import type { WorkspaceChatRow, WorkspaceOrganizationRow, WorkspaceRow } from '@/types/workspace'

const ChatSchema = z.object({ message: z.string().min(1).max(2000) })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)
  const { id } = await params

  const { data: ws } = await supabase.from('workspaces').select('id').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!ws) return apiError('not_found', 'Workspace not found', 404)

  const { data } = await supabase
    .from('workspace_chats')
    .select('*')
    .eq('workspace_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)
  const { id } = await params

  const parsed = await parseBody(req, ChatSchema)
  if ('response' in parsed) return parsed.response

  const { message } = parsed.data

  // Load workspace, organization, and recent chat history
  const [wsRes, orgRes, historyRes] = await Promise.all([
    supabase.from('workspaces').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('workspace_organization').select('*').eq('workspace_id', id).maybeSingle(),
    supabase.from('workspace_chats').select('*').eq('workspace_id', id).order('created_at', { ascending: false }).limit(10),
  ])

  if (wsRes.error || !wsRes.data) return apiError('not_found', 'Workspace not found', 404)

  const workspace = wsRes.data as WorkspaceRow
  const organization = orgRes.data as WorkspaceOrganizationRow | null
  const history = ((historyRes.data ?? []) as WorkspaceChatRow[]).reverse()

  // Save user message
  await supabase.from('workspace_chats').insert({
    workspace_id: id,
    user_id: user.id,
    role: 'user',
    content: message,
  })

  const textStream = await streamWorkspaceChat(workspace, organization, history, message)

  if (!textStream) {
    const fallback = 'No AI models are configured. Please add at least one WORKSPACE_*_API_KEY environment variable.'
    await supabase.from('workspace_chats').insert({
      workspace_id: id,
      user_id: user.id,
      role: 'assistant',
      content: fallback,
    })
    return NextResponse.json({ reply: fallback })
  }

  // Collect streamed text and save after completion
  const { textStream: ts } = textStream
  let fullText = ''
  for await (const chunk of ts) {
    fullText += chunk
  }

  await supabase.from('workspace_chats').insert({
    workspace_id: id,
    user_id: user.id,
    role: 'assistant',
    content: fullText,
    model_used: null,
  })

  return NextResponse.json({ reply: fullText })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)
  const { id } = await params

  const { error } = await supabase.from('workspace_chats')
    .delete().eq('workspace_id', id).eq('user_id', user.id)

  if (error) return handleError(error)
  return NextResponse.json({ cleared: true })
}
