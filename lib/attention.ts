import { LEADS } from '@/lib/config'
import {
  formatLocalTime,
  isWithinQuiet,
  nextLocalTime,
  nextQuietEnd,
} from '@/lib/timeZone'
import type { TimeKind } from '@/lib/timeExtraction'
import type { AttentionSettings, Category, PeopleKind } from '@/types/domain'

export type DeliveryPlan = {
  type: 'interrupt' | 'digest' | 'none'
  eventType: 'urgent_notice' | 'people_alert' | 'digest' | null
  notifyAt: Date | null
  reason: string
  breakThrough: boolean
  suppressedByBudget: boolean
}

export type PlanInput = {
  category: Category
  peopleKind: PeopleKind | null
  actBy: Date | null
  actKind: TimeKind | null
  isBreaking: boolean
  now: Date
  settings: AttentionSettings
  interruptsToday: number
}

const MIN = 60_000

/** End of whichever quiet/focus window is active at `at`, or null if none is. */
export function activeHoldEnd(at: Date, s: AttentionSettings): Date | null {
  const ends: Date[] = []
  const focusUntil = s.focus_until ? new Date(s.focus_until) : null
  if (focusUntil && focusUntil.getTime() > at.getTime() && s.current_mode !== 'normal') {
    ends.push(focusUntil)
  }
  if (s.current_mode === 'quiet' && !(focusUntil && focusUntil.getTime() > at.getTime())) {
    ends.push(nextLocalTime(at, s.timezone, s.quiet_end))
  }
  if (isWithinQuiet(at, s.timezone, s.quiet_start, s.quiet_end)) {
    ends.push(nextQuietEnd(at, s.timezone, s.quiet_start, s.quiet_end))
  }
  if (!ends.length) return null
  return new Date(Math.max(...ends.map((d) => d.getTime())))
}

export function nextDigestAt(now: Date, s: AttentionSettings): Date {
  return nextLocalTime(now, s.timezone, s.digest_time)
}

function leadMinutes(kind: TimeKind | null, s: AttentionSettings) {
  return kind === 'deadline' ? s.deadline_lead_hours * 60 : s.meeting_lead_minutes
}

function digestPlan(now: Date, s: AttentionSettings, reason: string, suppressed = false): DeliveryPlan {
  const hold = activeHoldEnd(now, s)
  let at = nextDigestAt(now, s)
  if (hold && hold.getTime() > at.getTime()) at = hold
  return { type: 'digest', eventType: 'digest', notifyAt: at, reason, breakThrough: false, suppressedByBudget: suppressed }
}

export function planDelivery(i: PlanInput): DeliveryPlan {
  const { now, settings: s } = i
  const tz = s.timezone
  const fmt = (d: Date) => formatLocalTime(d, tz)
  const budgetLeft = i.interruptsToday < s.interruption_budget

  if (i.category === 'for_you') {
    return { type: 'none', eventType: null, notifyAt: null, reason: 'For You never interrupts.', breakThrough: false, suppressedByBudget: false }
  }

  if (i.category === 'summaries') {
    return digestPlan(now, s, `Held for the ${fmt(nextDigestAt(now, s))} digest.`)
  }

  if (i.category === 'people') {
    if (i.peopleKind === 'ordinary' || i.peopleKind === null) {
      return digestPlan(now, s, 'Ordinary activity is grouped into the digest.')
    }
    if (activeHoldEnd(now, s)) {
      return digestPlan(now, s, 'Quiet or focus time is active; held for the digest.')
    }
    if (!budgetLeft) {
      return digestPlan(now, s, `Interruption budget of ${s.interruption_budget} reached; held for the digest.`, true)
    }
    return { type: 'interrupt', eventType: 'people_alert', notifyAt: now, reason: 'Priority, repeat or missed-call contact surfaces immediately.', breakThrough: false, suppressedByBudget: false }
  }

  // urgent
  if (i.actBy) {
    const latestUseful = Math.max(now.getTime(), i.actBy.getTime() - LEADS.minimumNoticeMinutes * MIN)
    let target = i.actBy.getTime() - leadMinutes(i.actKind, s) * MIN
    const leadText =
      i.actKind === 'deadline' ? `${s.deadline_lead_hours}h` : `${s.meeting_lead_minutes} min`
    let reason = `Notice ${leadText} before ${fmt(i.actBy)}.`
    if (target < now.getTime()) {
      target = now.getTime()
      reason = `Less than ${leadText} remains before ${fmt(i.actBy)}; notifying as soon as possible.`
    }
    let notifyAt = target
    let breakThrough = false
    const hold = activeHoldEnd(new Date(target), s)
    if (hold) {
      if (hold.getTime() > latestUseful) {
        breakThrough = true
        notifyAt = Math.min(target, latestUseful)
        reason = `Scheduled for ${fmt(i.actBy)}, before your quiet period ends at ${fmt(hold)}; notifying before the event.`
      } else {
        notifyAt = Math.max(target, hold.getTime())
        reason = `Held until your quiet period ends at ${fmt(hold)}; still before the ${fmt(i.actBy)} event.`
      }
    }
    notifyAt = Math.max(now.getTime(), Math.min(notifyAt, latestUseful))

    if (!budgetLeft) {
      const digest = nextDigestAt(now, s)
      if (digest.getTime() > latestUseful) {
        return {
          type: 'interrupt',
          eventType: 'urgent_notice',
          notifyAt: new Date(notifyAt),
          reason: `${reason} Interruption budget reached, but waiting for the digest would miss the event.`,
          breakThrough: true,
          suppressedByBudget: false,
        }
      }
      return digestPlan(now, s, `Interruption budget of ${s.interruption_budget} reached; the ${fmt(digest)} digest comes before the event.`, true)
    }
    return { type: 'interrupt', eventType: 'urgent_notice', notifyAt: new Date(notifyAt), reason, breakThrough, suppressedByBudget: false }
  }

  // breaking news: no event time, so quiet/focus and the budget apply
  const hold = activeHoldEnd(now, s)
  if (hold) return digestPlan(now, s, 'Breaking topic, but quiet or focus time is active; held for the digest.')
  if (!budgetLeft) return digestPlan(now, s, `Interruption budget of ${s.interruption_budget} reached; held for the digest.`, true)
  return { type: 'interrupt', eventType: 'urgent_notice', notifyAt: now, reason: 'Multiple independent sources reported a topic you follow.', breakThrough: false, suppressedByBudget: false }
}
