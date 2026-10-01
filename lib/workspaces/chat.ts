/**
 * Workspace chat — live per-question agent.
 * Reads stored organization from DB. Does NOT re-run the full pipeline.
 */
import { streamText } from 'ai'
import { runWithFallback } from '@/lib/workspaces/models'
import type { WorkspaceChatRow, WorkspaceOrganizationRow, WorkspaceRow } from '@/types/workspace'
import type { LanguageModel } from 'ai'

export async function streamWorkspaceChat(
  workspace: WorkspaceRow,
  organization: WorkspaceOrganizationRow | null,
  history: WorkspaceChatRow[],
  userMessage: string,
): Promise<ReturnType<typeof streamText> | null> {

  const systemPrompt = `
You are a workspace assistant helping with: "${workspace.subject}" (${workspace.domain})
User's goal: ${workspace.intent}${workspace.intent_note ? ` — ${workspace.intent_note}` : ''}

${organization ? `
WORKSPACE ORGANIZATION:
${organization.sections.map(s => `
SECTION: ${s.title}
${s.summary}
Resources: ${s.resource_ids.length}
`).join('')}

OVERVIEW: ${organization.synthesis?.overview ?? 'Not yet generated'}

KEY CONCEPTS: ${organization.synthesis?.key_concepts?.join(', ') ?? 'None'}
` : 'This workspace has not been organized yet.'}

You have access to the workspace resources and their organization.
Answer questions specifically about the workspace content.
Be concise and direct. Reference sections and resources when relevant.
Do not make up information not in the workspace.
`.trim()

  const messages = [
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]

  const result = await runWithFallback(async (model: LanguageModel) => {
    return streamText({
      model,
      system: systemPrompt,
      messages,
    })
  })

  return result?.result ?? null
}
