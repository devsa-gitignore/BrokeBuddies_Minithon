/**
 * Agent 2 — Classify
 * For each resource: assigns tags, concepts, and entities.
 * Runs all resources in a single batched prompt to minimize credit usage.
 */
import { generateObject } from 'ai'
import { z } from 'zod'
import { runWithFallback } from '@/lib/workspaces/models'
import type { ClassifiedResource, PipelineContext } from '@/types/workspace'

const ClassifySchema = z.object({
  resources: z.array(z.object({
    id: z.string(),
    tags: z.array(z.string()).max(5).describe('Short category tags (max 5)'),
    concepts: z.array(z.string()).max(6).describe('Key concepts this resource covers (max 6)'),
    entities: z.array(z.string()).max(6).describe('Named things: tools, libraries, people, events (max 6)'),
  }))
})

export async function runClassifyAgent(ctx: PipelineContext): Promise<PipelineContext> {
  const { workspace, resources, conceptMap, keyTerms } = ctx
  if (!resources.length) return ctx

  const resourcesPayload = resources.map(r => ({
    id: r.id,
    type: r.resource_type,
    title: r.title,
    text: (r.extracted_text ?? '').slice(0, 800), // cap to save tokens
  }))

  const prompt = `
You are classifying resources for a ${workspace.domain} workspace on "${workspace.subject}".

Domain concepts: ${(conceptMap ?? []).join(', ')}
Key terms: ${(keyTerms ?? []).join(', ')}

Resources to classify (JSON):
${JSON.stringify(resourcesPayload, null, 2)}

For EACH resource, return its id, 3-5 tags, key concepts it covers, and named entities.
`.trim()

  const out = await runWithFallback(async (model) => {
    const { object } = await generateObject({ model, schema: ClassifySchema, prompt })
    return object
  })

  // Merge classification back onto resource rows
  const classifiedMap = new Map(out?.result.resources.map(r => [r.id, r]) ?? [])

  const classifiedResources: ClassifiedResource[] = resources.map(r => ({
    ...r,
    tags: classifiedMap.get(r.id)?.tags ?? [],
    concepts: classifiedMap.get(r.id)?.concepts ?? [],
    entities: classifiedMap.get(r.id)?.entities ?? [],
  }))

  return {
    ...ctx,
    classifiedResources,
    modelUsed: out?.modelId ?? ctx.modelUsed,
  }
}
