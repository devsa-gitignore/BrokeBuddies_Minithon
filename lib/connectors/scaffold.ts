/**
 * Real connector implementations.
 * 
 * - RSS: reads user-configured RSS feeds from source_connections and fetches live XML.
 * - Gmail: fetches recent emails via Gmail API using a stored OAuth access_token in config.
 * - Telegram: polls for new messages via Bot API using a bot_token in config.
 *
 * Each connector is called by the background ingest job. They require the user's
 * source_connections rows to carry the relevant config (see inline comments per connector).
 */

import type { Connector } from './types'
import type { RawItem } from '@/types/domain'

/* ─── Shared helpers ──────────────────────────────────────────── */

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

/* ─── RSS Connector ───────────────────────────────────────────── */
/**
 * Reads RSS/Atom feeds stored in source_connections where source_type = 'rss'.
 * The connection's config JSON must contain: { url: string, topicHint?: string }
 * Items older than 24 hours are skipped.
 */

const DAY_MS = 24 * 3_600_000
const PER_FEED = 8

function parseRssXml(xml: string, sourceName: string): RawItem[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? []
  const out: RawItem[] = []
  for (const b of blocks) {
    const title = tag(b, 'title')
    const link = tag(b, 'link') ?? b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? null
    const date = tag(b, 'pubDate') ?? tag(b, 'published') ?? tag(b, 'updated')
    const ts = date ? new Date(date) : null
    if (!title || !ts || Number.isNaN(ts.getTime())) continue
    if (Date.now() - ts.getTime() > DAY_MS) continue
    out.push({
      externalId: link,
      source: sourceName,
      sourceType: 'rss',
      title: title.slice(0, 300),
      url: link,
      timestamp: ts.toISOString(),
      metadata: {},
    })
    if (out.length >= PER_FEED) break
  }
  return out
}

export const rssConnector: Connector = {
  name: 'RSS Feeds',
  sourceType: 'rss',
  /**
   * Expects each source_connection row with source_type='rss' to have:
   *   config: { url: string, name?: string }
   * Pass these as `connectionConfigs` via the opts parameter of the calling code.
   * When called standalone (e.g. from background job), the caller must supply configs.
   */
  async fetchItems(_userId: string, connectionConfigs?: { url: string; name?: string }[]): Promise<RawItem[]> {
    if (!connectionConfigs?.length) return []

    const results = await Promise.allSettled(
      connectionConfigs.map(async (cfg) => {
        const res = await fetch(cfg.url, {
          signal: AbortSignal.timeout(8_000),
          headers: { 'user-agent': 'AttentionFilter/1.0' },
        })
        if (!res.ok) return []
        return parseRssXml(await res.text(), cfg.name ?? new URL(cfg.url).hostname)
      })
    )

    return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  },
}

/* ─── Gmail Connector ─────────────────────────────────────────── */
/**
 * Reads the user's inbox via the Gmail API.
 * The source_connection config must contain:
 *   { access_token: string, refresh_token?: string, client_id?: string, client_secret?: string }
 *
 * Only unread threads from the last 24 hours are fetched. Message bodies are NOT stored —
 * only sender, subject, date, and a snippet preview are kept.
 */

const GMAIL_API = 'https://www.googleapis.com/gmail/v1'

async function gmailGet(path: string, token: string) {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`gmail_api_${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

function decodeBase64(s: string): string {
  try {
    return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

function extractHeader(headers: { name: string; value: string }[], name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null
}

export const gmailConnector: Connector = {
  name: 'Gmail',
  sourceType: 'gmail',
  async fetchItems(_userId: string, connectionConfigs?: { access_token: string }[]): Promise<RawItem[]> {
    const cfg = connectionConfigs?.[0]
    if (!cfg?.access_token) return []

    const token = cfg.access_token
    const since = Math.floor((Date.now() - DAY_MS) / 1_000)

    // List unread message IDs from last 24 h (max 20)
    let listData: Record<string, unknown>
    try {
      listData = await gmailGet(
        `/users/me/messages?q=is:unread after:${since}&maxResults=20`,
        token
      )
    } catch {
      return []
    }

    const messageList = (listData.messages as { id: string }[] | undefined) ?? []
    if (!messageList.length) return []

    const items: RawItem[] = []

    await Promise.allSettled(
      messageList.slice(0, 15).map(async ({ id }) => {
        try {
          const msg = await gmailGet(`/users/me/messages/${id}?format=metadata&metadataHeaders=From,Subject,Date`, token)
          const headers = (msg.internalDate !== undefined
            ? ((msg as Record<string, unknown>).payload as Record<string, unknown>)?.headers
            : []) as { name: string; value: string }[]

          const subject = extractHeader(headers, 'Subject') ?? '(no subject)'
          const from = extractHeader(headers, 'From') ?? ''
          const date = extractHeader(headers, 'Date')
          const snippet = typeof msg.snippet === 'string' ? msg.snippet.slice(0, 200) : null
          const ts = date ? new Date(date) : new Date(Number(msg.internalDate))

          // Extract sender name and address from "From" header
          const fromMatch = from.match(/^(?:"?([^"<]+)"?\s)?<?([^>]*)>?$/)
          const senderName = fromMatch?.[1]?.trim() || fromMatch?.[2]?.trim() || from
          const senderEmail = fromMatch?.[2]?.trim() || from

          items.push({
            externalId: id,
            source: 'Gmail',
            sourceType: 'gmail',
            sender: senderName,
            senderIdentifier: senderEmail,
            title: subject.slice(0, 300),
            // snippet is a preview, not the full body — safe to store
            text: snippet,
            url: `https://mail.google.com/mail/u/0/#inbox/${id}`,
            timestamp: Number.isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString(),
            metadata: { platform: 'gmail', messageId: id },
          })
        } catch {
          // skip individual message failures
        }
      })
    )

    return items
  },
}

/* ─── Telegram Connector ──────────────────────────────────────── */
/**
 * Polls for new messages via the Telegram Bot API (getUpdates long-poll).
 * The source_connection config must contain:
 *   { bot_token: string, offset?: number }
 *
 * The offset should be persisted between calls so messages aren't re-fetched.
 * Since we cannot write back to config during fetch here, the caller is responsible
 * for storing the latest update_id + 1 as the new offset after processing.
 *
 * PRIVACY: Message text is NOT stored. Only sender name, chat info, and timestamp.
 */

const TELEGRAM_API = 'https://api.telegram.org/bot'

export const telegramConnector: Connector = {
  name: 'Telegram',
  sourceType: 'telegram',
  async fetchItems(
    _userId: string,
    connectionConfigs?: { bot_token: string; offset?: number }[]
  ): Promise<RawItem[]> {
    const cfg = connectionConfigs?.[0]
    if (!cfg?.bot_token) return []

    const offset = cfg.offset ?? 0

    let updatesData: Record<string, unknown>
    try {
      const res = await fetch(
        `${TELEGRAM_API}${cfg.bot_token}/getUpdates?offset=${offset}&limit=50&timeout=5`,
        { signal: AbortSignal.timeout(15_000) }
      )
      if (!res.ok) return []
      updatesData = await res.json()
    } catch {
      return []
    }

    if (!updatesData.ok) return []

    const updates = (updatesData.result as Record<string, unknown>[]) ?? []
    const items: RawItem[] = []

    for (const update of updates) {
      const msg = (update.message ?? update.channel_post) as Record<string, unknown> | undefined
      if (!msg) continue

      const from = msg.from as Record<string, unknown> | undefined
      const chat = msg.chat as Record<string, unknown> | undefined
      const date = typeof msg.date === 'number' ? new Date(msg.date * 1000) : new Date()

      // Skip messages older than 24 h
      if (Date.now() - date.getTime() > DAY_MS) continue

      const senderName = from
        ? [from.first_name, from.last_name].filter(Boolean).join(' ') || String(from.username ?? 'Unknown')
        : chat?.title as string ?? 'Telegram'

      const senderIdentifier = from?.username
        ? `@${from.username}`
        : from?.id
          ? `tg:${from.id}`
          : null

      const chatTitle = chat?.title as string | undefined
      const notificationType = msg.photo ? 'photo'
        : msg.video ? 'video'
        : msg.voice ? 'voice_note'
        : msg.sticker ? 'sticker'
        : 'message'

      // PRIVACY: We do NOT store msg.text — only metadata
      items.push({
        externalId: `tg-${update.update_id}`,
        source: chatTitle ? `Telegram: ${chatTitle}` : 'Telegram',
        sourceType: 'telegram' as any,  // extend SourceType if needed
        sender: senderName,
        senderIdentifier: senderIdentifier as string | null,
        timestamp: date.toISOString(),
        title: null,
        text: null,
        url: null,
        metadata: {
          platform: 'telegram',
          chatId: chat?.id,
          chatType: chat?.type,
          notificationType,
          updateId: update.update_id,
        },
      })
    }

    return items
  },
}
