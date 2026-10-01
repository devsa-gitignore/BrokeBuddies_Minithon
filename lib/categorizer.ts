import { DISCOVERY_SOURCE_TYPES, URGENT_MIN_CONFIDENCE, CLUSTERABLE_SOURCE_TYPES, BREAKING } from '@/lib/config'
import type { TimeExtraction } from '@/lib/timeExtraction'
import type { Category, PeopleKind, SourceType } from '@/types/domain'

export type CategorizeInput = {
  sourceType: SourceType
  time: TimeExtraction
  isPriority: boolean
  repeatCount: number
  isMissedCall: boolean
  topicMatches: string[]
  keywordMatches: string[]
  ignoredBy: string | null
  cluster: { independentSourceCount: number; isBreaking: boolean; topicMatch: boolean } | null
  platform: string
}

export type Categorization = {
  category: Category
  peopleKind: PeopleKind | null
  isLowPriority: boolean
  urgentReason: 'scheduled' | 'breaking' | null
}

export function isScheduledToday(t: TimeExtraction): boolean {
  return (
    t.hasTimeSignal &&
    !!t.actBy &&
    t.confidence >= URGENT_MIN_CONFIDENCE &&
    t.dateRelation === 'today' &&
    !t.overdue
  )
}

export function categorize(i: CategorizeInput): Categorization {
  const relevant = i.topicMatches.length > 0 || i.keywordMatches.length > 0
  const ignored = !!i.ignoredBy

  if (i.sourceType === 'phone_notification') {
    const kind: PeopleKind = i.isMissedCall
      ? 'missed_call'
      : i.isPriority
        ? 'priority'
        : i.repeatCount >= 3
          ? 'repeat'
          : 'ordinary'
    return { category: 'people', peopleKind: kind, isLowPriority: ignored, urgentReason: null }
  }

  const discovery = DISCOVERY_SOURCE_TYPES.includes(i.sourceType)

  if (!ignored && !discovery && isScheduledToday(i.time)) {
    return { category: 'urgent', peopleKind: null, isLowPriority: false, urgentReason: 'scheduled' }
  }
  if (!ignored && i.cluster?.isBreaking && i.cluster.topicMatch) {
    return { category: 'urgent', peopleKind: null, isLowPriority: false, urgentReason: 'breaking' }
  }
  if (i.sourceType === 'gmail' && i.isPriority) {
    return { category: 'people', peopleKind: 'priority', isLowPriority: ignored, urgentReason: null }
  }
  if (discovery) {
    return { category: 'for_you', peopleKind: null, isLowPriority: ignored || !relevant, urgentReason: null }
  }
  if (CLUSTERABLE_SOURCE_TYPES.includes(i.sourceType)) {
    if (i.cluster && i.cluster.independentSourceCount >= 2) {
      return { category: 'summaries', peopleKind: null, isLowPriority: ignored || (!relevant && !i.cluster.topicMatch), urgentReason: null }
    }
    return { category: 'for_you', peopleKind: null, isLowPriority: ignored || !relevant, urgentReason: null }
  }
  if (i.sourceType === 'job_mock') {
    return relevant
      ? { category: 'summaries', peopleKind: null, isLowPriority: ignored, urgentReason: null }
      : { category: 'for_you', peopleKind: null, isLowPriority: true, urgentReason: null }
  }
  // gmail (non-urgent, non-priority), calendar (not today / already past)
  return {
    category: 'summaries',
    peopleKind: null,
    isLowPriority: ignored || i.time.overdue,
    urgentReason: null,
  }
}

const PLATFORM_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  gmail: 'Gmail',
  phone: 'phone',
}

export type WhyInput = {
  categorization: Categorization
  platform: string
  repeatCount: number
  time: TimeExtraction
  timeLabel: string | null
  deliveryReason: string | null
  topicMatches: string[]
  keywordMatches: string[]
  ignoredBy: string | null
  cluster: { sourceCount: number; independentSourceCount: number; spreadMinutes: number | null; topic: string | null } | null
  overdue: boolean
}

/** Short reason assembled from the actual scoring inputs. No model output involved. */
export function buildWhy(w: WhyInput): string {
  const c = w.categorization
  if (w.ignoredBy) return `Retained as low priority: matches your ignore rule "${w.ignoredBy}".`
  switch (c.category) {
    case 'people': {
      const label = PLATFORM_LABEL[w.platform] ?? 'phone'
      if (c.peopleKind === 'priority') return `From a priority ${label} contact.`
      if (c.peopleKind === 'repeat') return `${w.repeatCount} contacts from the same sender within 60 minutes.`
      if (c.peopleKind === 'missed_call') return 'Missed call.'
      return 'Ordinary message activity, grouped with other messages.'
    }
    case 'urgent': {
      if (c.urgentReason === 'breaking' && w.cluster) {
        const within = w.cluster.spreadMinutes !== null ? ` within ${Math.max(1, Math.round(w.cluster.spreadMinutes))} minutes` : ''
        return `Matches your ${w.cluster.topic ?? 'selected'} topic and ${w.cluster.independentSourceCount} independent sources reported it${within}. ${w.deliveryReason ?? ''}`.trim()
      }
      const when = w.time.timeKnown ? `Scheduled for today at ${w.timeLabel}.` : 'Due today (no exact time given).'
      return `${when} ${w.deliveryReason ?? ''}`.trim()
    }
    case 'summaries': {
      if (w.cluster && w.cluster.independentSourceCount >= 2) {
        return `${w.cluster.sourceCount} items from ${w.cluster.independentSourceCount} independent sources cover this event.`
      }
      if (w.overdue) return 'The scheduled time has already passed.'
      if (w.topicMatches.length) return `Matches your ${w.topicMatches[0]} topic; nothing time-bound today.`
      return 'Non-urgent update with no time-bound item for today.'
    }
    case 'for_you': {
      if (w.topicMatches.length) return `Suggested because ${w.topicMatches[0]} is one of your selected interests.`
      if (w.keywordMatches.length) return `Suggested because it mentions "${w.keywordMatches[0]}", one of your keywords.`
      return 'Retained as low priority: it matches none of your topics or keywords.'
    }
  }
}

export { BREAKING }
