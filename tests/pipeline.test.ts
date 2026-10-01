import { describe, expect, it } from 'vitest'
import { adaptPhonePayload } from '@/lib/adapters/phoneNotification'
import { planDelivery } from '@/lib/attention'
import { computeClusterStats, matchCluster, tokenize } from '@/lib/clustering'
import { normalizeRawItem, ValidationError } from '@/lib/normalizer'
import { containsTerm } from '@/lib/scoring'
import { generateWebhookToken, hashToken, isPlausibleToken, tokenHint } from '@/lib/security/token'
import { extractTime } from '@/lib/timeExtraction'
import type { AttentionSettings, ClusterRow } from '@/types/domain'

const settings: AttentionSettings = {
  timezone: 'UTC',
  quiet_start: '22:00',
  quiet_end: '08:00',
  digest_time: '16:00',
  meeting_lead_minutes: 60,
  deadline_lead_hours: 24,
  interruption_budget: 3,
  current_mode: 'normal',
  focus_until: null,
}

describe('webhook tokens', () => {
  it('generates unique plausible tokens and hashes deterministically', () => {
    const a = generateWebhookToken()
    const b = generateWebhookToken()
    expect(a).not.toBe(b)
    expect(isPlausibleToken(a)).toBe(true)
    expect(isPlausibleToken('short')).toBe(false)
    expect(hashToken(a)).toBe(hashToken(a))
    expect(hashToken(a)).not.toBe(a)
    expect(tokenHint(a)).not.toBe(a)
  })
})

describe('phone notification adapter', () => {
  const now = new Date('2026-01-10T10:00:00Z')

  it('maps generic payloads and strips message content', () => {
    const raw = adaptPhonePayload({ app: 'WhatsApp', sender: 'Maya', body: 'secret text' }, {}, now)
    const item = normalizeRawItem(raw, { now })
    expect(item.sourceType).toBe('phone_notification')
    expect(item.sender).toBe('Maya')
    expect(item.text).toBeNull()
    expect(item.title).toBeNull()
  })

  it('honours a custom payload mapping', () => {
    const raw = adaptPhonePayload({ who: { name: 'Sam' }, app: 'Phone' }, { sender: 'who.name' }, now)
    expect(raw.sender).toBe('Sam')
  })

  it('rejects non-object and empty payloads', () => {
    expect(() => adaptPhonePayload('nope', {}, now)).toThrow(ValidationError)
    expect(() => adaptPhonePayload([], {}, now)).toThrow(ValidationError)
    expect(() => adaptPhonePayload({ body: 'x' }, {}, now)).toThrow(ValidationError)
  })
})

describe('normalizer', () => {
  it('produces a stable dedupe key for the same input', () => {
    const input = { source: 'BBC', sourceType: 'rss', title: 'Hello world', url: 'https://example.com/a', externalId: 'g1' }
    expect(normalizeRawItem(input).dedupeKey).toBe(normalizeRawItem({ ...input }).dedupeKey)
  })

  it('rejects unknown source types', () => {
    expect(() => normalizeRawItem({ source: 'x', sourceType: 'carrier_pigeon', title: 't' })).toThrow(ValidationError)
  })
})

describe('time extraction', () => {
  const now = new Date('2026-01-10T10:00:00Z')

  it('returns no signal for text without a schedule', () => {
    const r = extractTime('Lovely weather this weekend', now, 'UTC')
    expect(r.actBy).toBeNull()
  })

  it('returns no signal for empty input', () => {
    expect(extractTime(null, now, 'UTC').actBy).toBeNull()
  })

  it('does not guess a date for an impossible calendar day', () => {
    expect(extractTime('Deadline Feb 31 at 5pm', now, 'UTC').actBy).toBeNull()
  })

  it('extracts a same-day meeting time', () => {
    const r = extractTime('Team meeting today at 3pm', now, 'UTC')
    expect(r.actBy?.toISOString()).toBe('2026-01-10T15:00:00.000Z')
  })
})

describe('term matching', () => {
  it('matches whole words only', () => {
    expect(containsTerm('The AI boom continues', 'ai')).toBe(true)
    expect(containsTerm('He said it was fair', 'ai')).toBe(false)
  })
})

describe('clustering', () => {
  it('tokenizes without stopwords and duplicates', () => {
    const t = tokenize('The chip makers and the chip shortage')
    expect(t).toContain('chip')
    expect(t).not.toContain('the')
    expect(t.filter((x) => x === 'chip')).toHaveLength(1)
  })

  const cluster = (signature: string): ClusterRow => ({
    id: 'c1', user_id: 'u', title: 't', topic: null, signature,
    first_seen_at: '', last_seen_at: '', source_count: 1, independent_source_count: 1,
    has_conflict: false, is_breaking: false, importance_score: 0, created_at: '', updated_at: '',
  })

  it('honours explicit cluster hints and ignores unrelated titles', () => {
    const c = cluster('hint:alpha')
    expect(matchCluster({ title: 'anything', metadata: { clusterHint: 'alpha' } }, [c])).toBe(c)
    expect(matchCluster({ title: 'anything', metadata: { clusterHint: 'beta' } }, [c])).toBeNull()
    expect(matchCluster({ title: 'Completely different subject here', metadata: {} }, [cluster('chip shortage factory')])).toBeNull()
  })

  const member = (id: string, source: string, minutes: number) => ({
    id, source, title: 'Chip shortage hits factories', text: null, metadata: {},
    timestamp: new Date(Date.UTC(2026, 0, 10, 10, minutes)).toISOString(),
    created_at: new Date(Date.UTC(2026, 0, 10, 10, minutes)).toISOString(),
  })

  it('counts independent publishers, not repeated posts from one', () => {
    const s = computeClusterStats(
      [member('1', 'BBC', 0), member('2', 'bbc', 5), member('3', 'Reuters', 8)],
      { topics: [{ topic: 'chip', weight: 1 }], keywords: [] },
    )
    expect(s.sourceCount).toBe(3)
    expect(s.independentSourceCount).toBe(2)
  })

  it('does not flag breaking without a topic match', () => {
    const s = computeClusterStats(
      [member('1', 'BBC', 0), member('2', 'Reuters', 1), member('3', 'AP', 2), member('4', 'CNN', 3)],
      { topics: [], keywords: [] },
    )
    expect(s.isBreaking).toBe(false)
  })
})

describe('attention delivery', () => {
  const base = {
    category: 'for_you' as const, peopleKind: null, actBy: null, actKind: null,
    isBreaking: false, now: new Date('2026-01-10T12:00:00Z'), settings, interruptsToday: 0,
  }

  it('never interrupts for For You items', () => {
    expect(planDelivery(base).type).toBe('none')
  })

  it('holds summaries for the digest', () => {
    const p = planDelivery({ ...base, category: 'summaries' })
    expect(p.type).toBe('digest')
    expect(p.notifyAt?.toISOString()).toBe('2026-01-10T16:00:00.000Z')
  })

  it('does not interrupt for ordinary people messages', () => {
    expect(planDelivery({ ...base, category: 'people', peopleKind: 'ordinary' }).type).not.toBe('interrupt')
  })
})
