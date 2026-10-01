import { createHash, randomBytes } from 'node:crypto'

/** 32 bytes of CSPRNG entropy, URL-safe. */
export function generateWebhookToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function tokenHint(token: string): string {
  return `...${token.slice(-4)}`
}

export function isPlausibleToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}
