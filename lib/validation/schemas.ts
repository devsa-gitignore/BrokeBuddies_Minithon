import { z } from 'zod'
import { isValidTimeZone } from '@/lib/timeZone'
import { LIMITS } from '@/lib/config'

export const uuidSchema = z.uuid()

export const hhmm = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h)')

export const rawItemSchema = z.object({
  externalId: z.string().max(300).nullish(),
  source: z.string().min(1).max(LIMITS.sender),
  sourceType: z.string().min(1).max(60),
  sender: z.string().max(LIMITS.sender * 2).nullish(),
  senderIdentifier: z.string().max(LIMITS.sender * 2).nullish(),
  timestamp: z.string().max(60).nullish(),
  title: z.string().max(LIMITS.title * 4).nullish(),
  text: z.string().max(LIMITS.text * 2).nullish(),
  url: z.string().max(LIMITS.url * 2).nullish(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  engagement: z.record(z.string(), z.number()).optional(),
})

export const MAPPING_FIELDS = [
  'externalId',
  'source',
  'appName',
  'packageName',
  'sender',
  'title',
  'body',
  'notificationType',
  'timestamp',
  'url',
] as const

export const payloadMappingSchema = z
  .partialRecord(z.enum(MAPPING_FIELDS), z.string().min(1).max(200).regex(/^[A-Za-z0-9_.\[\]-]+$/, 'Invalid path'))
  .default({})

export const connectionCreateSchema = z.object({
  sourceType: z.enum(['phone_notification', 'rss', 'gmail', 'calendar', 'reddit_mock', 'instagram_mock', 'x_mock', 'job_mock']),
  name: z.string().trim().min(1).max(100).optional(),
  payloadMapping: payloadMappingSchema.optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export const connectionPatchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  payloadMapping: payloadMappingSchema.optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export const jobSearchSchema = z.object({
  role: z.string().trim().max(100).optional(),
  level: z.enum(['intern', 'entry', 'mid', 'senior', 'lead', 'any']).optional(),
  remote: z.enum(['remote', 'hybrid', 'onsite', 'any']).optional(),
  location: z.string().trim().max(100).optional(),
  industries: z.array(z.string().trim().max(60)).max(10).optional(),
  skills: z.array(z.string().trim().max(60)).max(20).optional(),
  urgentFor: z.array(z.enum(['openings', 'deadlines', 'interviews', 'company_news', 'salary'])).optional(),
})

export const settingsPatchSchema = z.object({
  timezone: z.string().refine(isValidTimeZone, 'Invalid IANA timezone').optional(),
  quiet_start: hhmm.optional(),
  quiet_end: hhmm.optional(),
  digest_time: hhmm.optional(),
  meeting_lead_minutes: z.number().int().min(0).max(24 * 60).optional(),
  deadline_lead_hours: z.number().int().min(0).max(24 * 14).optional(),
  interruption_budget: z.number().int().min(0).max(50).optional(),
  current_mode: z.enum(['normal', 'focus', 'quiet']).optional(),
  focus_until: z.iso.datetime({ offset: true }).nullable().optional(),
  session_duration_minutes: z.number().int().min(5).max(240).optional(),
  attention_filter: z.enum(['all', 'important', 'urgent_only']).optional(),
  breaking_news_topics: z.array(z.string().trim().max(80)).max(20).optional(),
  urgent_categories: z.array(z.string().trim().max(80)).max(20).optional(),
  job_search: jobSearchSchema.nullable().optional(),
  topics: z.array(z.object({ topic: z.string().trim().min(1).max(80), weight: z.number().int().min(1).max(5).default(1) })).max(50).optional(),
  keywords: z.array(z.object({ keyword: z.string().trim().min(1).max(80), weight: z.number().int().min(1).max(5).default(1) })).max(100).optional(),
  ignoreRules: z
    .array(z.object({ rule_type: z.enum(['keyword', 'sender', 'source']), rule_value: z.string().trim().min(1).max(200), enabled: z.boolean().default(true) }))
    .max(100)
    .optional(),
  priorityPeople: z
    .array(
      z.object({
        person_name: z.string().trim().min(1).max(200),
        sender_identifier: z.string().trim().max(200).nullish().transform((v) => v || null),
        source_type: z.enum(['whatsapp', 'instagram', 'phone', 'gmail', 'any']),
        priority_weight: z.number().int().min(1).max(15).default(15),
        enabled: z.boolean().default(true),
      }),
    )
    .max(200)
    .optional(),
})

export const feedbackSchema = z.object({
  itemId: uuidSchema.optional(),
  action: z.enum(['important', 'not_important', 'read', 'dismiss', 'calibration_important', 'calibration_not_important']),
  note: z.string().max(300).optional(),
})

export const itemsQuerySchema = z.object({
  category: z.enum(['people', 'urgent', 'summaries', 'for_you']).optional(),
  sourceType: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  includeLow: z.enum(['true', 'false']).default('false'),
})

export const onboardingSchema = z.object({
  displayName: z.string().trim().max(100).optional(),
  purpose: z.array(z.string().max(60)).max(10).default([]),
  sourcesUsed: z.array(z.string().max(40)).max(20),
  settings: settingsPatchSchema,
  calibration: z.array(z.object({ key: z.string().max(60), important: z.boolean() })).max(20).default([]),
})
