import type { SourceType } from '@/types/domain'

export const PROCESSING_VERSION = 'v1'

export const LIMITS = {
  webhookBodyBytes: 64 * 1024,
  title: 500,
  text: 20_000,
  sender: 500,
  url: 2_000,
} as const

export const RATE_LIMIT_PER_MINUTE = 120

export const REPEAT = { minEvents: 3, windowMinutes: 60 } as const

export const BREAKING = { minIndependentSources: 3, windowMinutes: 60 } as const

export const CLUSTER = {
  lookbackHours: 48,
  minOverlapTokens: 3,
  minOverlapRatio: 0.6,
  maxSignatureTokens: 40,
} as const

export const LEADS = {
  meetingMinutes: 60,
  deadlineHours: 24,
  minimumNoticeMinutes: 15,
} as const

export const URGENT_MIN_CONFIDENCE = 0.6

export const SCORE_MAX = {
  relevance: 40,
  urgency: 30,
  sender: 15,
  novelty: 10,
  context: 5,
} as const

export const RELEVANCE_WEIGHTS = {
  firstTopic: 20,
  extraTopic: 5,
  keyword: 8,
  keywordCap: 16,
} as const

export const SOURCE_BASE_RELEVANCE: Record<SourceType, number> = {
  calendar: 25,
  gmail: 10,
  phone_notification: 10,
  job_mock: 5,
  rss: 0,
  article_mock: 0,
  reddit_mock: 0,
  instagram_mock: 0,
  x_mock: 0,
  social_mock: 0,
}

export const CLUSTERABLE_SOURCE_TYPES: SourceType[] = ['rss', 'article_mock']
export const DISCOVERY_SOURCE_TYPES: SourceType[] = [
  'reddit_mock',
  'instagram_mock',
  'x_mock',
  'social_mock',
]
export const TITLE_ONLY_TIME_SOURCES: SourceType[] = ['rss', 'article_mock']
export const NO_TIME_EXTRACTION_SOURCES: SourceType[] = [
  'phone_notification',
  ...DISCOVERY_SOURCE_TYPES,
]

export const DEFAULT_SETTINGS = {
  timezone: 'UTC',
  quiet_start: '22:00',
  quiet_end: '08:00',
  digest_time: '16:00',
  meeting_lead_minutes: LEADS.meetingMinutes,
  deadline_lead_hours: LEADS.deadlineHours,
  interruption_budget: 3,
  current_mode: 'normal' as const,
  focus_until: null,
}

export const RSS_FEEDS: { id: string; name: string; url: string; topicHint: string }[] = [
  {
    id: 'bbc-tech',
    name: 'BBC News Technology',
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    topicHint: 'Technology',
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    topicHint: 'Startups',
  },
  {
    id: 'verge',
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    topicHint: 'Technology',
  },
  {
    id: 'ars',
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    topicHint: 'Technology',
  },
  {
    id: 'motorsport-f1',
    name: 'Motorsport.com F1',
    url: 'https://www.motorsport.com/rss/f1/news/',
    topicHint: 'F1',
  },
  {
    id: 'hn',
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    topicHint: 'Startups',
  },
]

export const AI_MODEL = process.env.AI_MODEL || 'google/gemini-2.5-flash'
export const AI_TIMEOUT_MS = 20_000
