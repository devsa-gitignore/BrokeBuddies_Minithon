export type LocalParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatterFor(tz: string) {
  let f = formatterCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatterCache.set(tz, f)
  }
  return f
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function zonedParts(date: Date, tz: string): LocalParts {
  const parts = Object.fromEntries(
    formatterFor(tz)
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

function tzOffsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const real = date.getTime() - date.getMilliseconds()
  return asUtc - real
}

export function zonedTimeToUtc(
  p: { year: number; month: number; day: number; hour?: number; minute?: number },
  tz: string,
): Date {
  const guess = Date.UTC(p.year, p.month - 1, p.day, p.hour ?? 0, p.minute ?? 0)
  const off = tzOffsetMs(new Date(guess), tz)
  let result = guess - off
  const off2 = tzOffsetMs(new Date(result), tz)
  if (off2 !== off) result = guess - off2
  return new Date(result)
}

export function localDateKey(date: Date, tz: string): string {
  const p = zonedParts(date, tz)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function addDays(p: { year: number; month: number; day: number }, n: number) {
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + n))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** [start, end) of the local calendar day containing `date`. */
export function localDayBounds(date: Date, tz: string) {
  const p = zonedParts(date, tz)
  const start = zonedTimeToUtc({ year: p.year, month: p.month, day: p.day }, tz)
  const next = addDays(p, 1)
  const end = zonedTimeToUtc(next, tz)
  return { start, end }
}

export function parseHHMM(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return 0
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return 0
  return h * 60 + mi
}

export function minutesOfDay(date: Date, tz: string): number {
  const p = zonedParts(date, tz)
  return p.hour * 60 + p.minute
}

/** Handles intervals that cross midnight, e.g. 22:00 -> 08:00. */
export function isWithinQuiet(date: Date, tz: string, start: string, end: string): boolean {
  const s = parseHHMM(start)
  const e = parseHHMM(end)
  if (s === e) return false
  const m = minutesOfDay(date, tz)
  return s < e ? m >= s && m < e : m >= s || m < e
}

/** The local time `hhmm` on the local day of `date`, shifted by `dayOffset` days. */
export function atLocalTime(date: Date, tz: string, hhmm: string, dayOffset = 0): Date {
  const p = zonedParts(date, tz)
  const d = addDays(p, dayOffset)
  const mins = parseHHMM(hhmm)
  return zonedTimeToUtc({ ...d, hour: Math.floor(mins / 60), minute: mins % 60 }, tz)
}

/** Next instant strictly after `date` at which the local clock reads `hhmm`. */
export function nextLocalTime(date: Date, tz: string, hhmm: string): Date {
  const today = atLocalTime(date, tz, hhmm, 0)
  return today.getTime() > date.getTime() ? today : atLocalTime(date, tz, hhmm, 1)
}

export function nextQuietEnd(date: Date, tz: string, start: string, end: string): Date {
  if (!isWithinQuiet(date, tz, start, end)) return date
  return nextLocalTime(date, tz, end)
}

export function formatLocalTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}
