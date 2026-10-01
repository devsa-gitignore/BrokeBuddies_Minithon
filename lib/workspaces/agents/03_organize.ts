/**
 * Agent 3 — Organize
 * Determines section structure from classified resources + user intent.
 * Sections emerge from content, not from a fixed template.
 */
import { generateObject } from 'ai'
import { z } from 'zod'
import { runWithFallback } from '@/lib/workspaces/models'
import type { OrganizationSection, PipelineContext } from '@/types/workspace'

const SectionSchema = z.object({
  sections: z.array(z.object({
    id: z.string().describe('Slug-like id e.g. "fundamentals"'),
    title: z.string().describe('Short section title, 1-4 words, uppercase'),
    summary: z.string().max(200).describe('1-2 sentences explaining what this section covers'),
    resource_ids: z.array(z.string()).describe('IDs of workspace resources that belong here'),
    tags: z.array(z.string()).max(4),
  })).min(1).max(8),
})

/** Intent → hint for the organizer */
const INTENT_HINTS: Record<string, string> = {
  teach_me:      'Structure from fundamentals → core concepts → advanced topics → practice examples.',
  study_plan:    'Structure as an ordered learning path: prerequisites → core → practice → review.',
  research_deep: 'Structure as: background → key claims → evidence → open questions → further reading.',
  code_guide:    'Structure as: setup → architecture → core patterns → examples → reference.',
  custom:        'Use the most logical structure for the subject and resources.',
}

export async function runOrganizeAgent(ctx: PipelineContext): Promise<PipelineContext> {
  const { workspace, classifiedResources, conceptMap } = ctx
  if (!classifiedResources?.length) return ctx

  const hint = INTENT_HINTS[workspace.intent] ?? INTENT_HINTS.custom
  const resourceSummary = classifiedResources.map(r => ({
    id: r.id,
    type: r.resource_type,
    title: r.title,
    tags: r.tags,
    concepts: r.concepts,
  }))

  const prompt = `
You are organizing a ${workspace.domain} workspace: "${workspace.subject}"
User intent: ${workspace.intent}
Organization hint: ${hint}

Sub-topics in this domain: ${(conceptMap ?? []).join(', ')}

Resources (with their classifications):
${JSON.stringify(resourceSummary, null, 2)}

Create 2-8 sections that organically emerge from the content.
Each resource should appear in exactly one section (use its id).
Titles should be SHORT (1-4 words) and UPPERCASE.
`.trim()

  const out = await runWithFallback(async (model) => {
    const { object } = await generateObject({ model, schema: SectionSchema, prompt })
    return object
  })

  if (!out) {
    // Deterministic fallback: one "All Resources" section
    const fallback: OrganizationSection = {
      id: 'all-resources',
      title: 'ALL RESOURCES',
      summary: `Resources for ${workspace.subject}`,
      resource_ids: (classifiedResources ?? []).map(r => r.id),
      tags: [],
    }
    return { ...ctx, sections: [fallback] }
  }

  return {
    ...ctx,
    sections: out.result.sections as OrganizationSection[],
    modelUsed: out.modelId,
  }
}
