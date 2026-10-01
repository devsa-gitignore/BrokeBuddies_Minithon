/**
 * Agent 5 — Visualize
 * Generates a Mermaid diagram that summarizes the workspace structure.
 * Only generates if it materially helps understanding.
 */
import { generateObject } from 'ai'
import { z } from 'zod'
import { runWithFallback } from '@/lib/workspaces/models'
import type { PipelineContext } from '@/types/workspace'

const VisualizeSchema = z.object({
  shouldVisualize: z.boolean().describe('true if a diagram materially helps understand this workspace'),
  diagramType: z.enum(['flowchart', 'mindmap', 'graph', 'timeline']).optional(),
  diagramTitle: z.string().max(60).optional().describe('Short title for the diagram'),
  mermaid: z.string().optional().describe('Complete valid Mermaid diagram source code'),
})

/** Mermaid dark theme init block for workspace colors */
const MERMAID_INIT = `%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#022E21',
  'primaryTextColor': '#D2CBFE',
  'primaryBorderColor': '#2a2a2a',
  'lineColor': '#444444',
  'secondaryColor': '#111111',
  'tertiaryColor': '#0a0a0a',
  'edgeLabelBackground': '#111111',
  'fontFamily': 'JetBrains Mono, monospace',
  'fontSize': '13px'
}}}%%`

export async function runVisualizeAgent(ctx: PipelineContext): Promise<PipelineContext> {
  const { workspace, sections, synthesis } = ctx
  if (!sections?.length) return ctx

  const sectionNames = sections.map(s => s.title).join(', ')
  const keyConcepts = (synthesis?.key_concepts ?? []).slice(0, 6).join(', ')

  const prompt = `
You are generating a Mermaid diagram for a ${workspace.domain} workspace: "${workspace.subject}"

Sections: ${sectionNames}
Key concepts: ${keyConcepts}

Rules:
- Only generate a diagram if it materially helps understanding (set shouldVisualize = false if not)
- For study workspaces: prefer flowchart (learning path) or mindmap
- For code workspaces: prefer flowchart (architecture/flow)
- For research workspaces: prefer graph or mindmap
- Central node should be the workspace subject
- Section nodes branch from the center
- Key concepts appear as leaf nodes under relevant sections
- Keep it to max 20 nodes total
- Include the Mermaid init block at the top: ${MERMAID_INIT}
- The diagram must be valid Mermaid syntax
- Use LR direction for flowcharts (left to right)
- Wrap all node labels in quotes if they contain spaces

Example flowchart structure (adapt to content):
${MERMAID_INIT}
flowchart LR
  C["WORKSPACE SUBJECT"]:::center
  S1["SECTION 1"]:::section
  S2["SECTION 2"]:::section
  K1["concept"]:::concept
  K2["concept"]:::concept
  C --> S1
  C --> S2
  S1 --> K1
  S2 --> K2
  classDef center fill:#CDFC8A,color:#000000,stroke:#CDFC8A
  classDef section fill:#022E21,color:#D2CBFE,stroke:#2a2a2a
  classDef concept fill:#111111,color:#888888,stroke:#2a2a2a
`.trim()

  const out = await runWithFallback(async (model) => {
    const { object } = await generateObject({ model, schema: VisualizeSchema, prompt })
    return object
  })

  if (!out || !out.result.shouldVisualize || !out.result.mermaid) {
    return ctx
  }

  return {
    ...ctx,
    diagramMermaid: out.result.mermaid,
    diagramTitle: out.result.diagramTitle ?? `${workspace.subject} — Overview`,
    diagramType: out.result.diagramType,
    modelUsed: out.modelId,
  }
}
