import {
  daysInMonth,
  localDateKey,
  localDayBounds,
  zonedParts,
  zonedTimeToUtc,
} from '@/lib/timeZone'

export type TimeKind = 'meeting' | 'deadline' | 'event'

export type TimeExtraction = {
  hasTimeSignal: boolean
  actBy: Date | null
  confidence: number
  evidence: string | null
  kind: TimeKind | null
  dateRelation: 'today' | 'tomorrow' | 'past' | 'future' | null
  timeKnown: boolean
  overdue: boolean
}

const NONE: TimeExtraction = {
  hasTimeSignal: false,
  actBy: null,
  confidence: 0,
  evidence: null,
  kind: null,
  dateRelation: null,
  timeKnown: false,
  overdue: false,
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const TIME_RE =
  /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])|\b([01]?\d|2[0-3]):([0-5]\d)\b|\b(noon|midnight)\b/gi

const DEADLINE_RE = /\b(deadline|closing|closes|close|due|submission|submit|apply by|applications? (?:close|due)|last date|ends?)\b/i
const MEETING_RE = /\b(meeting|interview|appointment|call|standup|sync|catch-?up|review|session)\b/i
const EVENT_RE = /\b(event|starts?|begins?|webinar|demo|flight|kick-?off|hackathon|deadline)\b/i
const RESCHEDULE_RE = /\b(moved|rescheduled|pushed|shifted|changed|postponed|brought forward|preponed)\b/i

type TimeMatch = { hour: number; minute: number; index: number; text: string }

function findTimes(text: string): TimeMatch[] {
  const out: TimeMatch[] = []
  for (const m of text.matchAll(TIME_RE)) {
    if (m[6]) {
      out.push({ hour: m[6].toLowerCase() === 'noon' ? 12 : 0, minute: 0, index: m.index ?? 0, text: m[0] })
    } else if (m[3]) {
      const h = Number(m[1])
      const mi = m[2] ? Number(m[2]) : 0
      if (h < 1 || h > 12 || mi > 59) continue
      const pm = m[3].toLowerCase().startsWith('p')
      out.push({ hour: (h % 12) + (pm ? 12 : 0), minute: mi, index: m.index ?? 0, text: m[0] })
    } else {
      out.push({ hour: Number(m[4]), minute: Number(m[5]), index: m.index ?? 0, text: m[0] })
    }
  }
  return out
}

function pickTime(text: string, times: TimeMatch[]): TimeMatch | null {
  if (!times.length) return null
  if (times.length > 1 && RESCHEDULE_RE.test(text)) {
    for (const t of times) {
      const before = text.slice(Math.max(0, t.index - 20), t.index).toLowerCase()
      if (/\bto\s+(?:today\s+at\s+|tomorrow\s+at\s+|at\s+)?$/.test(before)) return t
    }
  }
  return times[0]
}

type DayMatch =
  | { kind: 'relative'; offset: number; text: string }
  | { kind: 'date'; year: number; month: number; day: number; text: string }
  | { kind: 'invalid'; text: string }

function findDay(text: string, nowYear: number): DayMatch | null {
  const lower = text.toLowerCase()
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(lower)
  if (iso) {
    const [y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return { kind: 'invalid', text: iso[0] }
    return { kind: 'date', year: y, month: mo, day: d, text: iso[0] }
  }
  const monthNames = MONTHS.join('|')
  const md = new RegExp(`\\b(${monthNames})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`).exec(lower)
  const dm = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})[a-z]*\\.?(?:,?\\s*(\\d{4}))?\\b`).exec(lower)
  const match = md
    ? { month: MONTHS.indexOf(md[1]) + 1, day: Number(md[2]), year: md[3] ? Number(md[3]) : nowYear, text: md[0] }
    : dm
      ? { month: MONTHS.indexOf(dm[2]) + 1, day: Number(dm[1]), year: dm[3] ? Number(dm[3]) : nowYear, text: dm[0] }
      : null
  if (match) {
    if (match.day < 1 || match.day > daysInMonth(match.year, match.month)) {
      return { kind: 'invalid', text: match.text }
    }
    return { kind: 'date', ...match }
  }
  if (/\b(today|tonight|this (?:morning|afternoon|evening))\b/.test(lower)) {
    return { kind: 'relative', offset: 0, text: /\b(today|tonight|this \w+)\b/.exec(lower)![0] }
  }
  if (/\btomorrow\b/.test(lower)) return { kind: 'relative', offset: 1, text: 'tomorrow' }
  if (/\byesterday\b/.test(lower)) return { kind: 'relative', offset: -1, text: 'yesterday' }
  return null
}

function detectKind(text: string): TimeKind | null {
  if (DEADLINE_RE.test(text)) return 'deadline'
  if (MEETING_RE.test(text)) return 'meeting'
  if (EVENT_RE.test(text)) return 'event'
  return null
}

function relation(actBy: Date, now: Date, tz: string): TimeExtraction['dateRelation'] {
  const a = localDateKey(actBy, tz)
  const n = localDateKey(now, tz)
  if (a === n) return 'today'
  if (actBy.getTime() < now.getTime()) return 'past'
  const { end } = localDayBounds(now, tz)
  const tomorrowEnd = new Date(end.getTime() + 24 * 3600 * 1000)
  return actBy.getTime() < tomorrowEnd.getTime() ? 'tomorrow' : 'future'
}

/** Deterministic, conservative extraction. Returns no signal rather than guessing. */
export function extractTime(text: string | null | undefined, now: Date, tz: string): TimeExtraction {
  if (!text) return NONE
  const input = text.slice(0, 1500)
  const nowParts = zonedParts(now, tz)
  const day = findDay(input, nowParts.year)
  if (day?.kind === 'invalid') {
    return { ...NONE, evidence: `Invalid date "${day.text}"` }
  }
  const time = pickTime(input, findTimes(input))
  const kind = detectKind(input)

  if (!day && !time) return NONE
  if (!day && time && !kind) return NONE
  if (day && !time && !kind) return NONE

  let base: { year: number; month: number; day: number }
  let dayLabel: string
  if (!day) {
    base = { year: nowParts.year, month: nowParts.month, day: nowParts.day }
    dayLabel = 'no date given, assumed today'
  } else if (day.kind === 'relative') {
    const d = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day + day.offset))
    base = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
    dayLabel = day.text
  } else {
    base = { year: day.year, month: day.month, day: day.day }
    dayLabel = day.text
  }

  let actBy: Date
  let confidence: number
  let timeKnown: boolean
  if (time) {
    actBy = zonedTimeToUtc({ ...base, hour: time.hour, minute: time.minute }, tz)
    timeKnown = true
    confidence = day ? (kind ? 0.95 : 0.9) : 0.7
  } else {
    actBy = zonedTimeToUtc({ ...base, hour: 23, minute: 59 }, tz)
    timeKnown = false
    confidence = 0.6
  }

  const rel = relation(actBy, now, tz)
  const overdue = timeKnown ? actBy.getTime() < now.getTime() : rel === 'past'
  const evidence = time ? `"${time.text.trim()}" (${dayLabel})` : `"${dayLabel}" with no exact time`
  return {
    hasTimeSignal: true,
    actBy,
    confidence,
    evidence,
    kind: kind ?? 'event',
    dateRelation: rel,
    timeKnown,
    overdue,
  }
}

/** Structured sources (calendar start, job closing) provide authoritative times. */
export function fromStructuredTime(
  iso: unknown,
  kind: TimeKind,
  now: Date,
  tz: string,
  evidence: string,
): TimeExtraction {
  if (typeof iso !== 'string') return NONE
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { ...NONE, evidence: 'Invalid structured date' }
  return {
    hasTimeSignal: true,
    actBy: d,
    confidence: 1,
    evidence,
    kind,
    dateRelation: relation(d, now, tz),
    timeKnown: true,
    overdue: d.getTime() < now.getTime(),
  }
}
