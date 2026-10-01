import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkspaceListClient } from '@/components/workspaces/WorkspaceListClient'
import type { WorkspaceRow } from '@/types/workspace'

export const metadata = { title: 'Workspaces' }

export default async function WorkspacesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  let workspaces: WorkspaceRow[] = []
  try {
    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    workspaces = (data ?? []) as WorkspaceRow[]
  } catch {
    // Table doesn't exist yet — migration not applied. Show empty state.
  }

  return <WorkspaceListClient initialWorkspaces={workspaces} />
}
