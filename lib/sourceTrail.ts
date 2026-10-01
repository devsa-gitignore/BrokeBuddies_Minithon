import type { ItemRow, SourceTrailEntry } from '@/types/domain'

export function isMockItem(item: Pick<ItemRow, 'source_type' | 'is_mock'>) {
  return item.is_mock || item.source_type.endsWith('_mock')
}

/** Builds the trail only from stored fields; URLs are never synthesised. */
export function buildSourceTrail(
  items: Pick<ItemRow, 'id' | 'source' | 'source_type' | 'timestamp' | 'url' | 'title' | 'is_mock' | 'created_at'>[],
): SourceTrailEntry[] {
  return [...items]
    .sort(
      (a, b) =>
        new Date(a.timestamp ?? a.created_at).getTime() - new Date(b.timestamp ?? b.created_at).getTime(),
    )
    .map((i) => ({
      itemId: i.id,
      publisher: i.source,
      sourceType: i.source_type,
      timestamp: i.timestamp,
      url: i.url,
      isMock: isMockItem(i),
      title: i.title,
    }))
}
