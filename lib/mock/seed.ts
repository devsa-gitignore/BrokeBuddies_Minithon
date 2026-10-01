import type { SupabaseClient } from '@supabase/supabase-js'
import { loadPrefs } from '@/lib/db/prefs'
import { normalizeRawItem } from '@/lib/normalizer'
import { processItem } from '@/lib/pipeline'
import { formatLocalTime } from '@/lib/timeZone'
import type { RawItem } from '@/types/domain'

const min = (now: Date, m: number) => new Date(now.getTime() + m * 60_000).toISOString()

/** Demo items, always flagged is_mock and labelled as such in the source name. */
export function buildMockItems(now: Date, tz: string): RawItem[] {
  const meeting = new Date(now.getTime() + 90 * 60_000)
  const meetingLabel = formatLocalTime(meeting, tz)
  return []
}

export async function seedMockData(admin: SupabaseClient, userId: string, now = new Date()) {
  const prefs = await loadPrefs(admin, userId)
  const items = buildMockItems(now, prefs.settings.timezone)
  const counts = { created: 0, duplicate: 0, failed: 0 }
  for (const raw of items) {
    try {
      const norm = normalizeRawItem(raw, { connectionId: 'mock', now })
      const out = await processItem(admin, userId, { ...norm, dedupeKey: `${userId.slice(0, 8)}:${norm.dedupeKey}` }, { isMock: true, now, prefs })
      counts[out.status] += 1
    } catch {
      counts.failed += 1
    }
  }
  return counts
}
