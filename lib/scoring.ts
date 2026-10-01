import { RELEVANCE_WEIGHTS, SCORE_MAX, SOURCE_BASE_RELEVANCE } from '@/lib/config'
import type { TimeExtraction } from '@/lib/timeExtraction'
import type { PriorityPerson, SourceType, UserPrefs } from '@/types/domain'

export type ScoreInput = {
  sourceType: SourceType
  hasUrl: boolean
  topicMatches: string[]
  keywordMatches: string[]
  priorityPerson: PriorityPerson | null
  repeatCount: number
  isMissedCall: boolean
  time: TimeExtraction
  scheduledToday: boolean
  isBreaking: boolean
  cluster: { independentSourceCount: number; isNew: boolean } | null
}

export type ScoreResult = {
  relevance: number
  urgency: number
  sender: number
  novelty: number
  context: number
  importance: number
  breakdown: Record<string, unknown>
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function containsTerm(haystack: string, term: string): boolean {
  const t = term.trim()
  if (!t) return false
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(t)}($|[^\\p{L}\\p{N}])`, 'iu')
  return re.test(haystack)
}

export function matchTerms(haystack: string, prefs: Pick<UserPrefs, 'topics' | 'keywords'>) {
  return {
    topics: prefs.topics.filter((t) => containsTerm(haystack, t.topic)).map((t) => t.topic),
    keywords: prefs.keywords.filter((k) => containsTerm(haystack, k.keyword)).map((k) => k.keyword),
  }
}

export function normalizeName(s: string | null | undefined) {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Priority contacts are source-scoped: a WhatsApp priority does not match Instagram. */
export function matchPriorityPerson(
  prefs: Pick<UserPrefs, 'priorityPeople'>,
  platform: string,
  sender: string | null,
  senderIdentifier: string | null,
): PriorityPerson | null {
  const name = normalizeName(sender)
  const ident = normalizeName(senderIdentifier)
  for (const p of prefs.priorityPeople) {
    if (!p.enabled) continue
    if (p.source_type !== 'any' && p.source_type !== platform) continue
    if (ident && p.sender_identifier && normalizeName(p.sender_identifier) === ident) return p
    if (name && normalizeName(p.person_name) === name) return p
    if (ident && normalizeName(p.person_name) === ident) return p
  }
  return null
}

/**
 * Deterministic importance. Engagement metrics (likes, views, shares) are
 * deliberately not inputs to any dimension.
 */
export function scoreItem(i: ScoreInput): ScoreResult {
  const base = SOURCE_BASE_RELEVANCE[i.sourceType] ?? 0
  const topicBonus = i.topicMatches.length
    ? RELEVANCE_WEIGHTS.firstTopic + (i.topicMatches.length - 1) * RELEVANCE_WEIGHTS.extraTopic
    : 0
  const keywordBonus = Math.min(RELEVANCE_WEIGHTS.keywordCap, i.keywordMatches.length * RELEVANCE_WEIGHTS.keyword)
  const relevance = Math.min(SCORE_MAX.relevance, base + topicBonus + keywordBonus)

  let urgency = 0
  if (i.scheduledToday && i.time.actBy && !i.time.overdue) {
    const minutesAway = (i.time.actBy.getTime() - Date.now()) / 60000
    urgency = minutesAway <= 60 ? 30 : minutesAway <= 180 ? 26 : 22
    if (!i.time.timeKnown) urgency = 15
  } else if (i.isBreaking) {
    urgency = 24
  }
  urgency = Math.min(SCORE_MAX.urgency, urgency)

  let sender = 0
  if (i.priorityPerson) sender = Math.min(SCORE_MAX.sender, i.priorityPerson.priority_weight)
  else if (i.isMissedCall) sender = 6
  else if (i.repeatCount >= 3) sender = 8

  let novelty = 0
  if (!i.cluster) novelty = i.sourceType === 'phone_notification' ? 0 : 5
  else if (i.cluster.independentSourceCount >= 2) novelty = Math.min(SCORE_MAX.novelty, 4 + i.cluster.independentSourceCount * 2)
  else novelty = i.cluster.isNew ? 4 : 2

  let context = 0
  if (i.hasUrl) context += 1
  if (i.cluster && i.cluster.independentSourceCount >= 2) context += 2
  if (i.topicMatches.length && i.keywordMatches.length) context += 2
  if (i.time.hasTimeSignal) context += 1
  context = Math.min(SCORE_MAX.context, context)

  const importance = relevance + urgency + sender + novelty + context
  return {
    relevance,
    urgency,
    sender,
    novelty,
    context,
    importance,
    breakdown: {
      relevance: { base, topicMatches: i.topicMatches, keywordMatches: i.keywordMatches },
      urgency: { scheduledToday: i.scheduledToday, breaking: i.isBreaking },
      sender: { priority: i.priorityPerson?.person_name ?? null, repeatCount: i.repeatCount, missedCall: i.isMissedCall },
      novelty: { independentSources: i.cluster?.independentSourceCount ?? null },
      max: SCORE_MAX,
    },
  }
}
