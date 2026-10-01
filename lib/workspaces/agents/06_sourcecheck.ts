/**
 * Agent 6 — Source Check
 * Verifies that synthesis claims are backed by actual resources.
 * Deterministic fallback: marks all as 'unchecked'.
 */
import { generateObject } from 'ai'
import { z } from 'zod'
import { runWithFallback } from '@/lib/workspaces/models'
import type { PipelineContext, SourceCheckIssue } from '@/types/workspace'

const SourceCheckSchema = z.object({
  issues: z.array(z.object({
    claim: z.string().describe('A specific claim from the synthesis'),
    verdict: z.enum(['supported', 'unsupported', 'partial']),
    resource_ids: z.array(z.string()).describe('IDs of resources that support this claim (empty if unsupported)'),
  }))
})

export async function runSourceCheckAgent(ctx: PipelineContext): Promise<PipelineContext> {
  const { synthesis, classifiedResources } = ctx
  if (!synthesis?.overview) return ctx

  // Extract the claims to check: overview sentences + key_concepts
  const claimsToCheck = [
    ...synthesis.overview.split('. ').filter(s => s.length > 20),
    ...synthesis.key_concepts.slice(0, 4),
  ].slice(0, 8) // max 8 claims to keep prompt small

  const resourceContext = (classifiedResources ?? []).map(r => ({
    id: r.id,
    title: r.title,
    concepts: r.concepts,
    tags: r.tags,
  }))

  const prompt = `
You are checking whether synthesis claims are supported by actual resources.

Claims to verify:
${claimsToCheck.map((c, i) => `${i + 1}. "${c}"`).join('\n')}

Available resources:
${JSON.stringify(resourceContext, null, 2)}

For each claim, determine if it is:
- "supported": clearly covered by at least one resource
- "partial": partially covered but not fully
- "unsupported": not covered by any resource

Include the resource IDs that support each supported/partial claim.
Do NOT invent support. If unsure, mark as "partial" or "unsupported".
`.trim()

  const out = await runWithFallback(async (model) => {
    const { object } = await generateObject({ model, schema: SourceCheckSchema, prompt })
    return object
  })

  if (!out) {
    // Deterministic fallback: mark everything as unchecked
    const fallbackIssues: SourceCheckIssue[] = claimsToCheck.map(c => ({
      claim: c,
      verdict: 'unchecked',
      resource_ids: [],
    }))
    return { ...ctx, sourceCheckIssues: fallbackIssues }
  }

  return {
    ...ctx,
    sourceCheckIssues: out.result.issues as SourceCheckIssue[],
    modelUsed: out.modelId,
  }
}
