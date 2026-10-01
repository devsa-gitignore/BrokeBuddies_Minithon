import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, apiError, parseBody, handleError } from '@/lib/api'
import { extractResource, detectResourceType } from '@/lib/workspaces/extractor'

const AddResourceSchema = z.object({ url: z.string().url() })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)
  const { id } = await params

  // Verify workspace belongs to user
  const { data: ws } = await supabase.from('workspaces').select('id').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!ws) return apiError('not_found', 'Workspace not found', 404)

  const { data } = await supabase
    .from('workspace_resources')
    .select('*')
    .eq('workspace_id', id)
    .order('position')

  return NextResponse.json({ resources: data ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)
  const { id } = await params

  // Verify workspace belongs to user
  const { data: ws } = await supabase.from('workspaces').select('id, resource_count').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!ws) return apiError('not_found', 'Workspace not found', 404)
  if ((ws.resource_count ?? 0) >= 30) return apiError('limit_exceeded', 'Workspace has reached the 30 resource limit', 422)

  const parsed = await parseBody(req, AddResourceSchema)
  if ('response' in parsed) return parsed.response

  const { url } = parsed.data
  const resourceType = detectResourceType(url)

  // Insert placeholder (position assigned by DB trigger)
  const { data: inserted, error: insertErr } = await supabase
    .from('workspace_resources')
    .insert({
      workspace_id: id,
      user_id: user.id,
      url,
      resource_type: resourceType,
      extract_status: 'pending',
    })
    .select('*')
    .single()

  if (insertErr) {
    if (insertErr.message?.includes('workspace_resource_limit_exceeded')) {
      return apiError('limit_exceeded', 'Workspace has reached the 30 resource limit', 422)
    }
    return handleError(insertErr)
  }

  // Extract content (async — update after response if you want streaming; here we do it inline)
  try {
    const extracted = await extractResource(url)
    await supabase
      .from('workspace_resources')
      .update({
        title: extracted.title,
        extracted_text: extracted.text,
        extracted_meta: extracted.meta,
        extract_status: extracted.error ? 'failed' : 'done',
        extract_error: extracted.error,
      })
      .eq('id', inserted.id)

    // Return the updated row
    const { data: updated } = await supabase.from('workspace_resources').select('*').eq('id', inserted.id).single()
    return NextResponse.json({ resource: updated }, { status: 201 })
  } catch {
    return NextResponse.json({ resource: inserted }, { status: 201 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Not authenticated', 401)
  const { id } = await params

  const { searchParams } = new URL(req.url)
  const resourceId = searchParams.get('resourceId')
  if (!resourceId) return apiError('validation_failed', 'resourceId query param required', 400)

  const { error } = await supabase
    .from('workspace_resources')
    .delete()
    .eq('id', resourceId)
    .eq('workspace_id', id)
    .eq('user_id', user.id)

  if (error) return handleError(error)
  return NextResponse.json({ deleted: true })
}
