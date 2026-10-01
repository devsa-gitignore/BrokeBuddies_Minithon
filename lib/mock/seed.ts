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
  return [
    { externalId: 'mock-cal-1', source: 'Calendar (mock)', sourceType: 'calendar', title: 'Design review with product team', text: 'Weekly design review', timestamp: min(now, -30), metadata: { eventStart: meeting.toISOString() } },
    { externalId: 'mock-cal-2', source: 'Calendar (mock)', sourceType: 'calendar', title: 'Morning standup', timestamp: min(now, -600), metadata: { eventStart: min(now, -300) } },
    { externalId: 'mock-mail-1', source: 'Gmail (mock)', sourceType: 'gmail', sender: 'Priya Shah', senderIdentifier: 'priya@example.com', title: 'Budget sign-off needed by 5pm today', text: `Hi, please approve the Q3 budget by 5pm today. We can also talk at ${meetingLabel}.`, timestamp: min(now, -45) },
    { externalId: 'mock-mail-2', source: 'Gmail (mock)', sourceType: 'gmail', sender: 'Newsletter', title: 'Your weekly product digest', text: 'Here is what shipped this week.', timestamp: min(now, -200) },
    { externalId: 'mock-mail-3', source: 'Gmail (mock)', sourceType: 'gmail', sender: 'AWS Billing', senderIdentifier: 'no-reply-aws@amazon.com', title: 'Action Required: Your invoice is ready', text: 'Your monthly AWS invoice for $1,245.00 is due today.', timestamp: min(now, -120) },
    ...[0, 12, 25, 41].map((m, i) => ({
      externalId: `mock-wa-rep-${i}`,
      source: 'Phone notifications (mock)',
      sourceType: 'phone_notification',
      sender: 'Maya',
      senderIdentifier: 'maya-wa',
      timestamp: min(now, -55 + m),
      metadata: { platform: 'whatsapp', appName: 'WhatsApp', notificationType: 'message' },
    })),
    ...[0, 5, 8, 14, 18, 22].map((m, i) => ({
      externalId: `mock-slack-urg-${i}`,
      source: 'Phone notifications (mock)',
      sourceType: 'phone_notification',
      sender: '#prod-outages',
      senderIdentifier: 'slack-prod-outages',
      timestamp: min(now, -30 + m),
      text: i === 0 ? 'Database CPU is spiking to 100%' : 'Still investigating...',
      metadata: { platform: 'slack', appName: 'Slack', notificationType: 'message' },
    })),
    { externalId: 'mock-wa-2', source: 'Phone notifications (mock)', sourceType: 'phone_notification', sender: 'Family group', senderIdentifier: 'family', timestamp: min(now, -20), metadata: { platform: 'whatsapp', appName: 'WhatsApp', notificationType: 'message' } },
    { externalId: 'mock-ig-1', source: 'Phone notifications (mock)', sourceType: 'phone_notification', sender: 'travel.daily', senderIdentifier: 'travel.daily', timestamp: min(now, -15), metadata: { platform: 'instagram', appName: 'Instagram', notificationType: 'message' } },
    { externalId: 'mock-call-1', source: 'Phone notifications (mock)', sourceType: 'phone_notification', sender: 'Unknown +44 7700 900123', senderIdentifier: '+447700900123', timestamp: min(now, -10), metadata: { platform: 'phone', appName: 'Phone', notificationType: 'missed_call' } },
    ...['Reuters', 'BBC Sport', 'Autosport'].map((p, i) => ({
      externalId: `mock-f1-${i}`,
      source: `${p} (mock)`,
      sourceType: 'article_mock',
      title: `Verstappen to leave Red Bull at the end of the season, reports say${i === 2 ? ' - team denies' : ''}`,
      text: 'Reports emerged of a driver move.',
      url: `https://example.com/mock/f1-${i}`,
      timestamp: min(now, -40 + i * 8),
      metadata: { clusterHint: 'f1-move', ...(i === 0 ? { claimKey: 'departure', claim: 'confirmed' } : i === 2 ? { claimKey: 'departure', claim: 'denied' } : {}) },
    })),
    ...['TechCrunch', 'The Verge', 'Bloomberg Tech', 'Wired'].map((p, i) => ({
      externalId: `mock-tech-merger-${i}`,
      source: `${p} (mock)`,
      sourceType: 'article_mock',
      title: `OpenAI in advanced talks to acquire Anthropic for $100B${i === 1 ? ' in historic AI merger' : i === 2 ? ' - regulators likely to block' : ''}`,
      text: 'Silicon valley is buzzing with rumors of a massive AI consolidation.',
      url: `https://example.com/mock/merger-${i}`,
      timestamp: min(now, -15 + i * 3), // Extremely tight clustering (breaking news pattern)
      metadata: { clusterHint: 'ai-merger' },
    })),
    { externalId: 'mock-ai-1', source: 'Tech Wire (mock)', sourceType: 'article_mock', title: 'New open-source language model released with 70 billion parameters', url: 'https://example.com/mock/ai-1', timestamp: min(now, -120), metadata: {} },
    { externalId: 'mock-rd-1', source: 'Reddit r/startups (mock)', sourceType: 'reddit_mock', title: 'How we got our first 100 customers without ads', url: 'https://example.com/mock/rd-1', timestamp: min(now, -90), engagement: { upvotes: 820, comments: 140 }, metadata: {} },
    { externalId: 'mock-x-1', source: 'X (mock)', sourceType: 'x_mock', sender: 'indie_hacker', title: 'Shipping small every day beats big launches. Thread.', url: 'https://example.com/mock/x-1', timestamp: min(now, -75), engagement: { likes: 310, reposts: 40 }, metadata: {} },
    { externalId: 'mock-x-2', source: 'X (mock)', sourceType: 'x_mock', sender: 'samaltman', title: 'going to be a wild week.', url: 'https://example.com/mock/x-2', timestamp: min(now, -25), engagement: { likes: 45000, reposts: 8000 }, metadata: {} },
    { externalId: 'mock-job-1', source: 'Jobs board (mock)', sourceType: 'job_mock', title: 'Senior Frontend Engineer - applications close today', url: 'https://example.com/mock/job-1', timestamp: min(now, -180), metadata: { closesAt: min(now, 300) } },
    { externalId: 'mock-delivery-1', source: 'Phone notifications (mock)', sourceType: 'phone_notification', sender: 'Amazon', senderIdentifier: 'amazon-app', timestamp: min(now, -5), title: 'Delivery Update', text: 'Your package is 10 stops away and will be delivered today.', metadata: { platform: 'amazon', appName: 'Amazon Shopping', notificationType: 'alert' } },
  ]
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
