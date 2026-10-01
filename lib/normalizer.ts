import { createHash } from 'node:crypto'
import { LIMITS } from '@/lib/config'
import {
  SOURCE_TYPES,
  type NormalizedItem,
  type RawItem,
  type SourceType,
} from '@/types/domain'

export class ValidationError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

const PRIVATE_KEY_RE = /^(body|text|message|content|ticker|subtext|bigtext|preview|snippet|messages)$/i
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const v = value.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim()
  if (!v) return null
  return v.length > max ? v.slice(0, max) : v
}

function cleanMultiline(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const v = value
    .replace(CONTROL_CHARS, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!v) return null
  return v.length > max ? v.slice(0, max) : v
}

export function normalizeSourceType(value: string): SourceType {
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if ((SOURCE_TYPES as readonly string[]).includes(v)) return v as SourceType
  throw new ValidationError('unknown_source', `Unknown source type: ${value.slice(0, 40)}`)
}

export function normalizeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const raw = value.trim()
  if (raw.length > LIMITS.url) {
    throw new ValidationError('invalid_url', 'URL exceeds maximum length')
  }
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new ValidationError('unsafe_url', 'Only http(s) URLs are accepted')
  }
  u.hash = ''
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|ref$)/i.test(key)) u.searchParams.delete(key)
  }
  return u.toString()
}

export function normalizeTimestamp(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  let d: Date
  if (typeof value === 'number') {
    d = new Date(value < 1e12 ? value * 1000 : value)
  } else if (typeof value === 'string') {
    const v = value.trim()
    d = /^\d{10,13}$/.test(v) ? new Date(Number(v) < 1e12 ? Number(v) * 1000 : Number(v)) : new Date(v)
  } else {
    throw new ValidationError('invalid_timestamp', 'Timestamp must be a string or number')
  }
  const t = d.getTime()
  if (Number.isNaN(t) || t < Date.UTC(2000, 0, 1) || t > Date.UTC(2100, 0, 1)) {
    throw new ValidationError('invalid_timestamp', 'Timestamp is not a valid date')
  }
  return d
}

export function stripPrivateKeys(value: unknown, depth = 0): unknown {
  if (depth > 4) return undefined
  if (Array.isArray(value)) return value.map((v) => stripPrivateKeys(v, depth + 1))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PRIVATE_KEY_RE.test(k)) continue
      out[k] = stripPrivateKeys(v, depth + 1)
    }
    return out
  }
  return value
}

/** Phone notifications are sender-only: no title, no body, no private metadata keys. */
export function sanitizePhoneItem(raw: RawItem): RawItem {
  return {
    ...raw,
    title: null,
    text: null,
    metadata: stripPrivateKeys(raw.metadata ?? {}) as Record<string, unknown>,
  }
}

function cleanMetadata(meta: Record<string, unknown> | undefined) {
  if (!meta) return {}
  const json = JSON.stringify(meta)
  if (json.length > 16_000) {
    throw new ValidationError('metadata_too_large', 'Metadata exceeds 16 KB')
  }
  return JSON.parse(json) as Record<string, unknown>
}

function cleanEngagement(e: Record<string, number> | undefined) {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(e ?? {})) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k.slice(0, 40)] = v
  }
  return out
}

export function normalizeRawItem(
  input: RawItem,
  opts: { connectionId?: string | null; now?: Date } = {},
): NormalizedItem {
  const sourceType = normalizeSourceType(input.sourceType)
  const raw = input

  const source = clean(raw.source, LIMITS.sender)
  if (!source) throw new ValidationError('missing_source', 'source is required')

  const sender = clean(raw.sender, LIMITS.sender)
  const senderIdentifier = clean(raw.senderIdentifier, LIMITS.sender)
  const senderKey = (senderIdentifier ?? sender)?.toLowerCase() ?? null
  const title = clean(raw.title, LIMITS.title)
  const text = cleanMultiline(raw.text, LIMITS.text)
  const url = normalizeUrl(raw.url)
  const timestamp = normalizeTimestamp(raw.timestamp)
  const externalId = clean(raw.externalId, 300)
  const metadata = cleanMetadata(raw.metadata)
  if (sourceType === 'phone_notification' && senderKey) metadata.senderKey = senderKey
  const engagement = cleanEngagement(raw.engagement)

  const canonicalText = (text ?? '').toLowerCase().replace(/\s+/g, ' ').slice(0, 2000)
  const canonicalTitle = (title ?? '').toLowerCase()

  let contentHash: string
  let dedupeKey: string
  if (sourceType === 'phone_notification') {
    const tsKey = timestamp
      ? metadata.timestampSource === 'received_at'
        ? timestamp.toISOString().slice(0, 16)
        : timestamp.toISOString()
      : 'none'
    contentHash = sha256(
      [sourceType, source.toLowerCase(), senderKey, metadata.notificationType ?? '', tsKey].join('|'),
    )
  } else {
    contentHash = sha256([sourceType, source.toLowerCase(), canonicalTitle, canonicalText, url ?? ''].join('|'))
  }
  if (externalId) {
    dedupeKey = `ext:${sha256(`${opts.connectionId ?? source.toLowerCase()}|${sourceType}|${externalId}`)}`
  } else {
    dedupeKey = `hash:${contentHash}`
  }

  if (sourceType !== 'phone_notification' && !title && !text) {
    throw new ValidationError('missing_content', 'Either title or text is required')
  }

  return {
    externalId,
    source,
    sourceType,
    sender,
    senderIdentifier,
    senderKey,
    timestamp,
    title,
    text,
    url,
    metadata,
    engagement,
    contentHash,
    dedupeKey,
  }
}
