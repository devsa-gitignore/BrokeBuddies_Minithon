import type { ItemRow } from '@/types/domain'

export type ConflictResult = {
  hasConflict: boolean
  evidence: string[]
  itemIds: string[]
}

type Member = Pick<ItemRow, 'id' | 'source' | 'title' | 'metadata'>

const NEGATION_RE = /\b(denies|denied|deny|refutes|refuted|disputes|disputed|debunks|no evidence|false|incorrect|contradicts)\b/i
const NUMBER_UNIT_RE = /(\d[\d,.]*)\s+([a-z]{3,})/gi

function numberUnits(title: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of title.matchAll(NUMBER_UNIT_RE)) {
    out.set(m[2].toLowerCase(), m[1].replace(/,/g, ''))
  }
  return out
}

/**
 * Conflict requires disagreement between at least two independent publishers:
 * (1) explicit claim metadata with differing values under one claimKey,
 * (2) the same quantity reported with different numbers,
 * (3) one report explicitly denying/disputing while another reports it plainly.
 * No credibility score is computed.
 */
export function detectConflict(members: Member[]): ConflictResult {
  const evidence: string[] = []
  const ids = new Set<string>()
  const publishers = new Set(members.map((m) => m.source.trim().toLowerCase()))
  if (publishers.size < 2) return { hasConflict: false, evidence, itemIds: [] }

  const byKey = new Map<string, Member[]>()
  for (const m of members) {
    const key = typeof m.metadata?.claimKey === 'string' ? m.metadata.claimKey : null
    if (key && m.metadata?.claim !== undefined) byKey.set(key, [...(byKey.get(key) ?? []), m])
  }
  for (const [key, group] of byKey) {
    const values = new Map<string, Member>()
    for (const g of group) values.set(String(g.metadata.claim), g)
    const pubs = new Set(group.map((g) => g.source.toLowerCase()))
    if (values.size > 1 && pubs.size > 1) {
      evidence.push(`Sources disagree on "${key}": ${[...values.keys()].join(' vs ')}`)
      group.forEach((g) => ids.add(g.id))
    }
  }

  const perUnit = new Map<string, Map<string, Member>>()
  for (const m of members) {
    if (!m.title) continue
    for (const [unit, num] of numberUnits(m.title)) {
      const inner = perUnit.get(unit) ?? new Map<string, Member>()
      if (!inner.has(num)) inner.set(num, m)
      perUnit.set(unit, inner)
    }
  }
  for (const [unit, inner] of perUnit) {
    const pubs = new Set([...inner.values()].map((m) => m.source.toLowerCase()))
    if (inner.size > 1 && pubs.size > 1) {
      evidence.push(`Different figures reported for "${unit}": ${[...inner.keys()].join(' vs ')}`)
      inner.forEach((m) => ids.add(m.id))
    }
  }

  const deniers = members.filter((m) => m.title && NEGATION_RE.test(m.title))
  const plain = members.filter((m) => m.title && !NEGATION_RE.test(m.title))
  if (deniers.length && plain.length) {
    const denierPubs = new Set(deniers.map((m) => m.source.toLowerCase()))
    const plainPubs = plain.filter((m) => !denierPubs.has(m.source.toLowerCase()))
    if (plainPubs.length) {
      evidence.push('One or more sources explicitly dispute what others report')
      deniers.forEach((m) => ids.add(m.id))
      plainPubs.forEach((m) => ids.add(m.id))
    }
  }

  return { hasConflict: evidence.length > 0, evidence, itemIds: [...ids] }
}
