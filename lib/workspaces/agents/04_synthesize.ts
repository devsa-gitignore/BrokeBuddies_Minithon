/**
 * Agent 4 — Synthesize
 * Produces workspace-level overview, key concepts, reading order, and gaps.
 */
import { generateObject } from 'ai'
import { z } from 'zod'
import { runWithFallback } from '@/lib/workspaces/models'
import type { PipelineContext, SynthesisOutput } from '@/types/workspace'

const SynthesisSchema = z.object({
  overview: z.string().max(400).describe('2-3 sentence workspace-level summary. What these resources collectively cover.'),
  key_concepts: z.array(z.string()).max(8).describe('Most important concepts across all resources (max 8)'),
  what_to_read_first: z.array(z.string()).max(5).describe('Resource IDs in recommended reading order (max 5)'),
  open_questions: z.array(z.string()).max(4).describe('Questions the resources raise but do not fully answer (max 4)'),
  source_gaps: z.array(z.string()).max(3).describe('Topics the user should add resources about (max 3)'),
})

export async function runSynthesizeAgent(ctx: PipelineContext): Promise<PipelineContext> {
  const { workspace, sections, classifiedResources } = ctx
  if (!sections?.length) return ctx

  const sectionSummary = sections.map(s => ({
    title: s.title,
    summary: s.summary,
    resourceCount: s.resource_ids.length,
  }))

  const resourceSummary = (classifiedResources ?? []).map(r => ({
    id: r.id,
    title: r.title,
    type: r.resource_type,
    concepts: r.concepts,
  }))

  const prompt = `
You are synthesizing a ${workspace.domain} workspace: "${workspace.subject}"
User intent: ${workspace.intent}

Sections created:
${JSON.stringify(sectionSummary, null, 2)}

Resources available (with IDs):
${JSON.stringify(resourceSummary, null, 2)}

Write:
1. A 2-3 sentence overview of what this workspace collectively covers
2. The 5-8 most important concepts
3. Which resource IDs to read/watch first (in order, max 5 — use the actual IDs)
4. Up to 4 open questions the resources raise
5. Up to 3 topic gaps the user should fill by adding more resources
`.trim()

  const out = await runWithFallback(async (model) => {
    const { object } = await generateObject({ model, schema: SynthesisSchema, prompt })
    return object
  })

  if (!out) {
    const fallback: SynthesisOutput = {
      overview: `This workspace covers ${workspace.subject} with ${(classifiedResources ?? []).length} resources.`,
      key_concepts: ctx.conceptMap?.slice(0, 8) ?? [],
      what_to_read_first: (classifiedResources ?? []).slice(0, 3).map(r => r.id),
      open_questions: [],
      source_gaps: [],
    }
    return { ...ctx, synthesis: fallback }
  }

  return {
    ...ctx,
    synthesis: out.result as SynthesisOutput,
    modelUsed: out.modelId,
  }
}
