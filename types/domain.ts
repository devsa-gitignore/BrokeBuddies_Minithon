export const CATEGORIES = ['urgent', 'people', 'summaries', 'for_you'] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  urgent: 'Urgent',
  people: 'People',
  summaries: 'Summaries',
  for_you: 'For You',
}

export const CATEGORY_PATHS: Record<Category, string> = {
  urgent: '/urgent',
  people: '/people',
  summaries: '/summaries',
  for_you: '/for-you',
}

export type PeopleKind = 'priority' | 'repeat' | 'missed_call' | 'ordinary'

export const SOURCE_TYPES = [
  'phone_notification',
  'calendar',
  'gmail',
  'rss',
  'reddit_mock',
  'instagram_mock',
  'x_mock',
  'job_mock',
  'article_mock',
  'social_mock',
] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export type SourceStatus =
  | 'connected'
  | 'live'
  | 'mock'
  | 'not_configured'
  | 'disabled'
  | 'error'

export type RawItem = {
  externalId?: string | null
  source: string
  sourceType: string
  sender?: string | null
  senderIdentifier?: string | null
  timestamp?: string | null
  title?: string | null
  text?: string | null
  url?: string | null
  metadata?: Record<string, unknown>
  engagement?: Record<string, number>
}

export type NormalizedItem = {
  externalId: string | null
  source: string
  sourceType: SourceType
  sender: string | null
  senderIdentifier: string | null
  senderKey: string | null
  timestamp: Date | null
  title: string | null
  text: string | null
  url: string | null
  metadata: Record<string, unknown>
  engagement: Record<string, number>
  contentHash: string
  dedupeKey: string
}

export type AttentionMode = 'normal' | 'focus' | 'quiet'

export type AttentionSettings = {
  timezone: string
  quiet_start: string
  quiet_end: string
  digest_time: string
  meeting_lead_minutes: number
  deadline_lead_hours: number
  interruption_budget: number
  current_mode: AttentionMode
  focus_until: string | null
}

export type PriorityPerson = {
  id?: string
  person_name: string
  sender_identifier: string | null
  source_type: string
  priority_weight: number
  enabled: boolean
}

export type IgnoreRule = {
  id?: string
  rule_type: 'keyword' | 'sender' | 'source'
  rule_value: string
  enabled: boolean
}

export type UserPrefs = {
  topics: { topic: string; weight: number }[]
  keywords: { keyword: string; weight: number }[]
  ignoreRules: IgnoreRule[]
  priorityPeople: PriorityPerson[]
  settings: AttentionSettings
}

export type ItemRow = {
  id: string
  user_id: string
  source_connection_id: string | null
  external_id: string | null
  source: string
  source_type: SourceType
  sender: string | null
  sender_identifier: string | null
  timestamp: string | null
  title: string | null
  text: string | null
  url: string | null
  category: Category
  relevance_score: number
  urgency_score: number
  sender_weight: number
  novelty_score: number
  context_score: number
  importance_score: number
  score_breakdown: Record<string, unknown>
  why: string | null
  act_by: string | null
  act_by_confidence: number | null
  urgency_evidence: string | null
  is_overdue: boolean
  is_low_priority: boolean
  is_mock: boolean
  people_kind: PeopleKind | null
  notify_at: string | null
  cluster_id: string | null
  content_hash: string | null
  dedupe_key: string
  engagement: Record<string, number>
  metadata: Record<string, unknown>
  processing_status: string
  processing_error: string | null
  processing_version: string
  processed_at: string | null
  is_read: boolean
  is_dismissed: boolean
  created_at: string
  updated_at: string
}

export type ClusterRow = {
  id: string
  user_id: string
  title: string
  topic: string | null
  signature: string | null
  first_seen_at: string
  last_seen_at: string
  source_count: number
  independent_source_count: number
  has_conflict: boolean
  is_breaking: boolean
  importance_score: number
  created_at: string
  updated_at: string
}

export type SummarySentence = { text: string; citationItemIds: string[] }

export type ClusterSummaryRow = {
  id: string
  cluster_id: string
  version: number
  summary_json: SummarySentence[]
  model: string | null
  status: 'pending' | 'ready' | 'unavailable'
  generated_at: string | null
  updated_at: string
}

export type SourceTrailEntry = {
  itemId: string
  publisher: string
  sourceType: string
  timestamp: string | null
  url: string | null
  isMock: boolean
  title: string | null
}

export type ConnectionRow = {
  id: string
  user_id: string
  source_type: string
  name: string
  status: SourceStatus
  enabled: boolean
  token_hint: string | null
  payload_mapping: Record<string, string>
  config: Record<string, unknown>
  last_received_at: string | null
  events_received: number
  last_error: string | null
  last_error_category: string | null
  last_error_at: string | null
  created_at: string
  updated_at: string
}
