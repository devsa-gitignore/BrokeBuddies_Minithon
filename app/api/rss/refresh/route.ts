import { NextResponse } from 'next/server'
import { apiError, requireUser } from '@/lib/api'
import { RSS_FEEDS } from '@/lib/config'
import { loadPrefs } from '@/lib/db/prefs'
import { normalizeRawItem } from '@/lib/normalizer'
import { processItem } from '@/lib/pipeline'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RawItem } from '@/types/domain'

export const maxDuration = 60
const PER_FEED = 6
const DAY = 24 * 3600_000

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .trim()
}
const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? decode(m[1]) : null
}

function parseFeed(xml: string, source: string): RawItem[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? []
  const out: RawItem[] = []
  for (const b of blocks.slice(0, 30)) {
    const title = tag(b, 'title')
    const link = tag(b, 'link') ?? b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? null
    const date = tag(b, 'pubDate') ?? tag(b, 'published') ?? tag(b, 'updated')
    const ts = date ? new Date(date) : null
    if (!title || !ts || Number.isNaN(ts.getTime())) continue
    if (Date.now() - ts.getTime() > DAY) continue
    out.push({ externalId: link, source, sourceType: 'rss', title: title.slice(0, 300), url: link, timestamp: ts.toISOString(), metadata: {} })
    if (out.length >= PER_FEED) break
  }
  return out
}

export async function POST() {
  const { user } = await requireUser()
  if (!user) return apiError('unauthorized', 'Sign in required', 401)
  const admin = createAdminClient()
  const prefs = await loadPrefs(admin, user.id)

  const results = await Promise.all(
    RSS_FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'AttentionBot/1.0' } })
        if (!res.ok) return { id: f.id, ok: false, items: [] as RawItem[] }
        return { id: f.id, ok: true, items: parseFeed(await res.text(), f.name) }
      } catch {
        return { id: f.id, ok: false, items: [] as RawItem[] }
      }
    }),
  )

  const counts = { created: 0, duplicate: 0, failed: 0 }
  for (const r of results) {
    for (const raw of r.items) {
      try {
        const norm = normalizeRawItem(raw, { connectionId: 'rss', now: new Date() })
        const out = await processItem(admin, user.id, norm, { prefs, isMock: false })
        counts[out.status] += 1
      } catch {
        counts.failed += 1
      }
    }
  }
  return NextResponse.json({ ok: true, feeds: results.map((r) => ({ id: r.id, ok: r.ok, fetched: r.items.length })), ...counts })
}
