import { NextResponse } from 'next/server'
import { requireUser, apiError, handleError } from '@/lib/api'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)
  const { id } = await params

  const [wsRes, orgRes, resourcesRes] = await Promise.all([
    supabase.from('workspaces').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('workspace_organization').select('*').eq('workspace_id', id).maybeSingle(),
    supabase.from('workspace_resources').select('*').eq('workspace_id', id).order('position'),
  ])

  if (wsRes.error || !wsRes.data) return apiError('not_found', 'Workspace not found', 404)

  return NextResponse.json({
    workspace: wsRes.data,
    organization: orgRes.data ?? null,
    resources: resourcesRes.data ?? [],
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)
  const { id } = await params

  const { error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return handleError(error)
  return NextResponse.json({ deleted: true })
}
