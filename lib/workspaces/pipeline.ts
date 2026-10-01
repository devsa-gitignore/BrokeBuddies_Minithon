/**
 * Workspace pipeline orchestrator.
 * Runs all 6 agents sequentially. Writes result to DB once at the end.
 * NOT re-run on every page open — only on explicit trigger or new resource.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PipelineContext, WorkspaceResourceRow, WorkspaceRow } from '@/types/workspace'
import { runContextAgent } from '@/lib/workspaces/agents/01_context'
import { runClassifyAgent } from '@/lib/workspaces/agents/02_classify'
import { runOrganizeAgent } from '@/lib/workspaces/agents/03_organize'
import { runSynthesizeAgent } from '@/lib/workspaces/agents/04_synthesize'
import { runVisualizeAgent } from '@/lib/workspaces/agents/05_visualize'
import { runSourceCheckAgent } from '@/lib/workspaces/agents/06_sourcecheck'

export type PipelineStep =
  | 'extracting'
  | 'context'
  | 'classify'
  | 'organize'
  | 'synthesize'
  | 'visualize'
  | 'sourcecheck'
  | 'saving'
  | 'done'
  | 'failed'

export type PipelineProgress = {
  step: PipelineStep
  stepIndex: number   // 0-7
  totalSteps: number  // 8
  modelUsed?: string
  error?: string
}

export type ProgressCallback = (progress: PipelineProgress) => void

const TOTAL_STEPS = 8

function progress(step: PipelineStep, stepIndex: number, extra?: Partial<PipelineProgress>): PipelineProgress {
  return { step, stepIndex, totalSteps: TOTAL_STEPS, ...extra }
}

export async function runWorkspacePipeline(
  db: SupabaseClient,
  workspaceId: string,
  userId: string,
  onProgress?: ProgressCallback,
): Promise<{ success: boolean; error?: string }> {

  // 1. Load workspace + resources
  onProgress?.(progress('extracting', 0))

  const { data: workspace, error: wsErr } = await db
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (wsErr || !workspace) return { success: false, error: 'workspace_not_found' }

  const { data: resourceRows } = await db
    .from('workspace_resources')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true })

  // Mark workspace as processing
  await db.from('workspaces').update({ org_status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', workspaceId).eq('user_id', userId)

  let ctx: PipelineContext = {
    workspace: workspace as WorkspaceRow,
    resources: (resourceRows ?? []) as WorkspaceResourceRow[],
  }

  try {
    // 2. Context agent
    onProgress?.(progress('context', 1))
    ctx = await runContextAgent(ctx)

    // 3. Classify agent
    onProgress?.(progress('classify', 2))
    ctx = await runClassifyAgent(ctx)

    // 4. Organize agent
    onProgress?.(progress('organize', 3))
    ctx = await runOrganizeAgent(ctx)

    // 5. Synthesize agent
    onProgress?.(progress('synthesize', 4))
    ctx = await runSynthesizeAgent(ctx)

    // 6. Visualize agent
    onProgress?.(progress('visualize', 5))
    ctx = await runVisualizeAgent(ctx)

    // 7. Source check agent
    onProgress?.(progress('sourcecheck', 6))
    ctx = await runSourceCheckAgent(ctx)

    // 8. Write to DB
    onProgress?.(progress('saving', 7))

    const { data: existing } = await db
      .from('workspace_organization')
      .select('id, version')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    const orgPayload = {
      workspace_id: workspaceId,
      version: (existing?.version ?? 0) + 1,
      sections: ctx.sections ?? [],
      synthesis: ctx.synthesis ?? {},
      diagram_mermaid: ctx.diagramMermaid ?? null,
      diagram_title: ctx.diagramTitle ?? null,
      diagram_type: ctx.diagramType ?? null,
      source_check: ctx.sourceCheckIssues ?? [],
      model_used: ctx.modelUsed ?? null,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      await db.from('workspace_organization').update(orgPayload).eq('id', existing.id)
    } else {
      await db.from('workspace_organization').insert(orgPayload)
    }

    await db.from('workspaces').update({
      org_status: 'ready',
      org_version: (existing?.version ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', workspaceId).eq('user_id', userId)

    onProgress?.(progress('done', 8, { modelUsed: ctx.modelUsed }))
    return { success: true }

  } catch (err) {
    console.error('[workspace/pipeline] Pipeline failed:', err)
    await db.from('workspaces').update({ org_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', workspaceId).eq('user_id', userId)

    onProgress?.(progress('failed', 8, { error: err instanceof Error ? err.message : 'unknown' }))
    return { success: false, error: err instanceof Error ? err.message : 'pipeline_failed' }
  }
}
