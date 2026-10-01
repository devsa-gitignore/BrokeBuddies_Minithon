import { planDelivery, type DeliveryPlan } from '@/lib/attention'
import { buildWhy, categorize, type Categorization } from '@/lib/categorizer'
import {
  NO_TIME_EXTRACTION_SOURCES,
  TITLE_ONLY_TIME_SOURCES,
  URGENT_MIN_CONFIDENCE,
} from '@/lib/config'
import { containsTerm, matchPriorityPerson, matchTerms, scoreItem, type ScoreResult } from '@/lib/scoring'
import { extractTime, fromStructuredTime, type TimeExtraction } from '@/lib/timeExtraction'
import { formatLocalTime } from '@/lib/timeZone'
import type { SourceType, UserPrefs } from '@/types/domain'

export type EvalItem = {
  sourceType: SourceType
  source: string
  sender: string | null
  senderIdentifier: string | null
  title: string | null
  text: string | null
  url: string | null
  metadata: Record<string, unknown>
}

export type EvalCluster = {
  id: string
  sourceCount: number
  independentSourceCount: number
  hasConflict: boolean
  isBreaking: boolean
  isNew: boolean
  topic: string | null
  spreadMinutes: number | null
}

export type EvalInput = {
  item: EvalItem
  prefs: UserPrefs
  now: Date
  cluster: EvalCluster | null
  repeatCount: number
  interruptsToday: number
}

export type EvalResult = {
  categorization: Categorization
  scores: ScoreResult
  why: string
  plan: DeliveryPlan
  time: TimeExtraction
  actBy: Date | null
  actByConfidence: number | null
  urgencyEvidence: string | null
  isOverdue: boolean
  platform: string
}

export function platformFor(item: Pick<EvalItem, 'sourceType' | 'metadata'>): string {
  const p = item.metadata.platform
  if (typeof p === 'string') return p
  if (item.sourceType === 'gmail') return 'gmail'
  if (item.sourceType === 'instagram_mock') return 'instagram'
  if (item.sourceType === 'phone_notification') return 'phone'
  return item.sourceType
}

export function resolveTime(item: EvalItem, now: Date, tz: string): TimeExtraction {
  if (item.sourceType === 'calendar' && item.metadata.eventStart) {
    return fromStructuredTime(item.metadata.eventStart, 'meeting', now, tz, 'Calendar event start time')
  }
  if (item.sourceType === 'job_mock' && item.metadata.closesAt) {
    return fromStructuredTime(item.metadata.closesAt, 'deadline', now, tz, 'Job listing closing time')
  }
  if (NO_TIME_EXTRACTION_SOURCES.includes(item.sourceType)) return extractTime(null, now, tz)
  const title = item.title ?? ''
  const text = TITLE_ONLY_TIME_SOURCES.includes(item.sourceType) ? title : `${title}. ${item.text ?? ''}`
  return extractTime(text, now, tz)
}

function matchIgnore(item: EvalItem, prefs: UserPrefs): string | null {
  const hay = `${item.title ?? ''} ${item.text ?? ''}`
  for (const r of prefs.ignoreRules) {
    if (!r.enabled) continue
    const v = r.rule_value.trim()
    if (!v) continue
    if (r.rule_type === 'keyword' && containsTerm(hay, v)) return v
    if (r.rule_type === 'sender' && item.sender && item.sender.toLowerCase() === v.toLowerCase()) return v
    if (r.rule_type === 'source' && item.source.toLowerCase() === v.toLowerCase()) return v
  }
  return null
}

/** Pure: same function scores live ingestion, mock data and re-evaluation. */
export function evaluateItem(input: EvalInput): EvalResult {
  const { item, prefs, now, cluster } = input
  const tz = prefs.settings.timezone
  const platform = platformFor(item)
  const hay = `${item.title ?? ''} ${item.text ?? ''}`
  const matched = matchTerms(hay, prefs)
  const clusterTopic = cluster?.topic ?? null
  const topicMatches = matched.topics.length ? matched.topics : clusterTopic ? [clusterTopic] : []
  const priority = matchPriorityPerson(prefs, platform, item.sender, item.senderIdentifier)
  const time = resolveTime(item, now, tz)
  const ignoredBy = matchIgnore(item, prefs)
  const isMissedCall = item.metadata.notificationType === 'missed_call'

  const categorization = categorize({
    sourceType: item.sourceType,
    time,
    isPriority: !!priority,
    repeatCount: input.repeatCount,
    isMissedCall,
    topicMatches: topicMatches,
    keywordMatches: matched.keywords,
    ignoredBy,
    cluster: cluster
      ? { independentSourceCount: cluster.independentSourceCount, isBreaking: cluster.isBreaking, topicMatch: !!clusterTopic }
      : null,
    platform,
  })

  const scheduledToday = categorization.urgentReason === 'scheduled'
  const isBreaking = categorization.urgentReason === 'breaking'

  const scores = scoreItem({
    sourceType: item.sourceType,
    hasUrl: !!item.url,
    topicMatches,
    keywordMatches: matched.keywords,
    priorityPerson: priority,
    repeatCount: input.repeatCount,
    isMissedCall,
    time,
    scheduledToday,
    isBreaking,
    cluster: cluster ? { independentSourceCount: cluster.independentSourceCount, isNew: cluster.isNew } : null,
  })

  const plan = planDelivery({
    category: categorization.category,
    peopleKind: categorization.peopleKind,
    actBy: scheduledToday ? time.actBy : null,
    actKind: time.kind,
    isBreaking,
    now,
    settings: prefs.settings,
    interruptsToday: input.interruptsToday,
  })

  const why = buildWhy({
    categorization,
    platform,
    repeatCount: input.repeatCount,
    time,
    timeLabel: time.actBy ? formatLocalTime(time.actBy, tz) : null,
    deliveryReason: categorization.category === 'urgent' ? plan.reason : null,
    topicMatches,
    keywordMatches: matched.keywords,
    ignoredBy,
    cluster: cluster
      ? {
          sourceCount: cluster.sourceCount,
          independentSourceCount: cluster.independentSourceCount,
          spreadMinutes: cluster.spreadMinutes,
          topic: clusterTopic,
        }
      : null,
    overdue: time.overdue,
  })

  const confident = time.hasTimeSignal && time.confidence >= URGENT_MIN_CONFIDENCE
  return {
    categorization,
    scores,
    why,
    plan,
    time,
    actBy: confident ? time.actBy : null,
    actByConfidence: time.hasTimeSignal ? time.confidence : null,
    urgencyEvidence: time.evidence,
    isOverdue: confident && time.overdue,
    platform,
  }
}
