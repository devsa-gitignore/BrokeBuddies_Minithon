/**
 * Agent 1 — Context
 * Understands the workspace subject domain. Uses model parametric knowledge only.
 * No external HTTP calls.
 */
import { generateObject } from 'ai'
import { z } from 'zod'
import { runWithFallback } from '@/lib/workspaces/models'
import type { PipelineContext } from '@/types/workspace'

const ContextSchema = z.object({
  domainContext: z.string().describe('2-3 sentences explaining the subject domain and why it matters.'),
  conceptMap: z.array(z.string()).max(12).describe('Key sub-topics or concepts within this subject (max 12).'),
  keyTerms: z.array(z.string()).max(20).describe('Important terminology a learner should know (max 20).'),
})

export async function runContextAgent(ctx: PipelineContext): Promise<PipelineContext> {
  const { workspace, resources } = ctx
  const resourceTitles = resources.map(r => r.title ?? r.url ?? 'Unknown').join(', ')

  const prompt = `
You are helping organize a ${workspace.domain} workspace.

Subject: "${workspace.subject}"
User intent: "${workspace.intent}" (${workspace.intent_note ?? ''})
Resources the user has added: ${resourceTitles || '(none yet)'}

Provide:
1. A brief domain context (what this subject is about, 2-3 sentences)
2. The key sub-topics or concepts within this subject
3. The most important terminology
`.trim()

  const out = await runWithFallback(async (model) => {
    const { object } = await generateObject({ model, schema: ContextSchema, prompt })
    return object
  })

  if (!out) {
    // Deterministic fallback
    return {
      ...ctx,
      domainContext: `This workspace covers ${workspace.subject}.`,
      conceptMap: [],
      keyTerms: [],
    }
  }

  return {
    ...ctx,
    domainContext: out.result.domainContext,
    conceptMap: out.result.conceptMap,
    keyTerms: out.result.keyTerms,
    modelUsed: out.modelId,
  }
}
