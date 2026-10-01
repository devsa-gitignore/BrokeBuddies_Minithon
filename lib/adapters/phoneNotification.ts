import { normalizeTimestamp, ValidationError } from '@/lib/normalizer'
import type { RawItem } from '@/types/domain'

type Field =
  | 'externalId'
  | 'source'
  | 'appName'
  | 'packageName'
  | 'sender'
  | 'title'
  | 'body'
  | 'notificationType'
  | 'timestamp'
  | 'url'

/**
 * Notification2Webhook has no documented payload schema that this app relies on.
 * The adapter therefore accepts generic JSON; a connection's payload_mapping
 * (field -> JSON path) overrides these guesses.
 */
export const DEFAULT_PATHS: Record<Field, string[]> = {
  externalId: ['id', 'notification_id', 'notificationId', 'externalId', 'key'],
  source: ['source'],
  appName: ['appName', 'app_name', 'app', 'application', 'appLabel'],
  packageName: ['packageName', 'package_name', 'package', 'pkg'],
  sender: ['sender', 'from', 'contact', 'title', 'user'],
  title: ['title'],
  body: ['body', 'text', 'message', 'content'],
  notificationType: ['notificationType', 'notification_type', 'type', 'category'],
  timestamp: ['timestamp', 'time', 'when', 'postTime', 'post_time', 'date'],
  url: ['url', 'link'],
}

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor'])

export function getByPath(obj: unknown, path: string): unknown {
  const segments = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
  let cur: unknown = obj
  for (const seg of segments) {
    if (FORBIDDEN_SEGMENTS.has(seg)) return undefined
    if (cur === null || typeof cur !== 'object') return undefined
    if (!Object.prototype.hasOwnProperty.call(cur, seg)) return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

function asString(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
}

function resolve(payload: unknown, field: Field, mapping: Record<string, string>): unknown {
  const mapped = mapping[field]
  if (mapped) return getByPath(payload, mapped)
  for (const p of DEFAULT_PATHS[field]) {
    const v = getByPath(payload, p)
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

export function platformOf(appName: string | null, packageName: string | null): string {
  const h = `${appName ?? ''} ${packageName ?? ''}`.toLowerCase()
  if (h.includes('whatsapp')) return 'whatsapp'
  if (h.includes('instagram')) return 'instagram'
  if (h.includes('gmail') || h.includes('android.gm')) return 'gmail'
  return 'phone'
}

export function adaptPhonePayload(
  payload: unknown,
  mapping: Record<string, string>,
  receivedAt: Date,
): RawItem {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('invalid_payload', 'Payload must be a JSON object')
  }
  const appName = asString(resolve(payload, 'appName', mapping))
  const packageName = asString(resolve(payload, 'packageName', mapping))
  const sender = asString(resolve(payload, 'sender', mapping))
  const explicitSource = asString(resolve(payload, 'source', mapping))
  if (!sender && !appName && !packageName && !explicitSource) {
    throw new ValidationError('missing_fields', 'Payload needs at least a sender or an app name')
  }

  // The body is read only to detect a missed-call marker; it is never returned or stored.
  const bodyText = asString(resolve(payload, 'body', mapping)) ?? ''
  const titleText = asString(resolve(payload, 'title', mapping)) ?? ''
  let notificationType = (asString(resolve(payload, 'notificationType', mapping)) ?? 'message').toLowerCase().slice(0, 40)
  if (/missed call|missed_call|missed voice call|missed video call/i.test(`${bodyText} ${titleText} ${notificationType}`)) {
    notificationType = 'missed_call'
  }

  const tsValue = resolve(payload, 'timestamp', mapping)
  const metadata: Record<string, unknown> = {
    appName,
    packageName,
    notificationType,
    platform: platformOf(appName, packageName),
  }
  let timestamp: string
  if (tsValue === undefined || tsValue === null || tsValue === '') {
    timestamp = receivedAt.toISOString()
    metadata.timestampSource = 'received_at'
  } else {
    const parsed = normalizeTimestamp(typeof tsValue === 'number' || typeof tsValue === 'string' ? tsValue : null)
    if (!parsed) throw new ValidationError('invalid_timestamp', 'Timestamp is not a valid date')
    timestamp = parsed.toISOString()
    metadata.timestampSource = 'event'
  }

  return {
    externalId: asString(resolve(payload, 'externalId', mapping)),
    source: explicitSource ?? appName ?? packageName ?? 'Phone',
    sourceType: 'phone_notification',
    sender,
    senderIdentifier: null,
    timestamp,
    title: null,
    text: null,
    url: null,
    metadata,
  }
}
