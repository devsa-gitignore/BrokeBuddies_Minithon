// Workspace domain types — completely independent from domain.ts

export type WorkspaceIntent =
  | 'teach_me'
  | 'study_plan'
  | 'research_deep'
  | 'code_guide'
  | 'custom'

export type WorkspaceDomain = 'research' | 'code' | 'study'

export type WorkspaceOrgStatus = 'pending' | 'processing' | 'ready' | 'failed'

export type ResourceType =
  | 'youtube'
  | 'reddit'
  | 'article'
  | 'pdf'
  | 'github'
  | 'other_url'

export type ResourceExtractStatus = 'pending' | 'done' | 'failed'

// -------------------------------------------------------
// DB row types
// -------------------------------------------------------

export type WorkspaceRow = {
  id: string
  user_id: string
  title: string
  subject: string
  intent: WorkspaceIntent
  intent_note: string | null
  domain: WorkspaceDomain
  resource_count: number
  org_status: WorkspaceOrgStatus
  org_version: number
  created_at: string
  updated_at: string
}

export type WorkspaceResourceRow = {
  id: string
  workspace_id: string
  user_id: string
  url: string | null
  resource_type: ResourceType
  title: string | null
  extracted_text: string | null
  extracted_meta: Record<string, unknown>
  extract_status: ResourceExtractStatus
  extract_error: string | null
  position: number
  added_at: string
}

export type OrganizationSection = {
  id: string
  title: string
  summary: string
  resource_ids: string[]
  tags: string[]
}

export type SynthesisOutput = {
  overview: string
  key_concepts: string[]
  what_to_read_first: string[]   // ordered workspace_resource ids
  open_questions: string[]
  source_gaps: string[]
}

export type SourceCheckIssue = {
  claim: string
  verdict: 'supported' | 'unsupported' | 'partial' | 'unchecked'
  resource_ids: string[]
}

export type WorkspaceOrganizationRow = {
  id: string
  workspace_id: string
  version: number
  sections: OrganizationSection[]
  synthesis: SynthesisOutput
  diagram_mermaid: string | null
  diagram_title: string | null
  diagram_type: string | null
  source_check: SourceCheckIssue[]
  model_used: string | null
  generated_at: string
  updated_at: string
}

export type WorkspaceNotesRow = {
  id: string
  workspace_id: string
  user_id: string
  content: string
  updated_at: string
}

export type WorkspaceChatRow = {
  id: string
  workspace_id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  model_used: string | null
  created_at: string
}

// -------------------------------------------------------
// Agent pipeline context (passed between agents)
// -------------------------------------------------------

export type PipelineContext = {
  workspace: WorkspaceRow
  resources: WorkspaceResourceRow[]
  // Accumulated across stages
  domainContext?: string
  conceptMap?: string[]
  keyTerms?: string[]
  classifiedResources?: ClassifiedResource[]
  sections?: OrganizationSection[]
  synthesis?: SynthesisOutput
  diagramMermaid?: string
  diagramTitle?: string
  diagramType?: string
  sourceCheckIssues?: SourceCheckIssue[]
  modelUsed?: string
}

export type ClassifiedResource = WorkspaceResourceRow & {
  tags: string[]
  concepts: string[]
  entities: string[]
}

// -------------------------------------------------------
// API payloads
// -------------------------------------------------------

export type CreateWorkspacePayload = {
  title: string
  subject: string
  intent: WorkspaceIntent
  intent_note?: string
  domain: WorkspaceDomain
}

export type AddResourcePayload = {
  url: string
}

export type PatchNotesPayload = {
  content: string
}

export type ChatMessagePayload = {
  message: string
}
