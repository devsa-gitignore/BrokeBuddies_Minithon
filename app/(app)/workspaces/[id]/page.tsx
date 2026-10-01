import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceBoard } from '@/components/workspaces/WorkspaceBoard'
import type {
  WorkspaceChatRow,
  WorkspaceNotesRow,
  WorkspaceOrganizationRow,
  WorkspaceResourceRow,
  WorkspaceRow,
} from '@/types/workspace'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('workspaces').select('title').eq('id', id).maybeSingle()
  return { title: data?.title ?? 'Workspace' }
}

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [wsRes, orgRes, resourcesRes, chatsRes, notesRes] = await Promise.all([
    supabase.from('workspaces').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('workspace_organization').select('*').eq('workspace_id', id).maybeSingle(),
    supabase.from('workspace_resources').select('*').eq('workspace_id', id).order('position'),
    supabase.from('workspace_chats').select('*').eq('workspace_id', id).order('created_at'),
    supabase.from('workspace_notes').select('*').eq('workspace_id', id).maybeSingle(),
  ])

  if (wsRes.error || !wsRes.data) notFound()

  return (
    <WorkspaceBoard
      workspace={wsRes.data as WorkspaceRow}
      organization={orgRes.data as WorkspaceOrganizationRow | null}
      resources={(resourcesRes.data ?? []) as WorkspaceResourceRow[]}
      messages={(chatsRes.data ?? []) as WorkspaceChatRow[]}
      notes={notesRes.data as WorkspaceNotesRow | null}
    />
  )
}
