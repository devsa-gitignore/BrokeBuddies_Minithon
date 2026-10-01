import type { RawItem } from '@/types/domain'

export interface Connector {
  name: string
  sourceType: string
  fetchItems(userId: string, connectionConfigs?: Record<string, unknown>[]): Promise<RawItem[]>
}

