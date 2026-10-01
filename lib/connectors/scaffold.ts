import type { Connector } from './types'
import type { RawItem } from '@/types/domain'

export const rssConnector: Connector = {
  name: 'RSS Feeds',
  sourceType: 'rss',
  async fetchItems(userId: string): Promise<RawItem[]> {
    // Scaffold: Real implementation would fetch from registered RSS feeds
    console.log(`[RSS] Fetching for user ${userId}...`)
    return []
  }
}

export const gmailConnector: Connector = {
  name: 'Gmail',
  sourceType: 'gmail',
  async fetchItems(userId: string): Promise<RawItem[]> {
    // Scaffold: Real implementation would use Google OAuth tokens to read recent emails
    console.log(`[Gmail] Fetching for user ${userId}...`)
    return []
  }
}

export const telegramConnector: Connector = {
  name: 'Telegram',
  sourceType: 'telegram',
  async fetchItems(userId: string): Promise<RawItem[]> {
    // Scaffold: Real implementation would read from Telegram MTProto or Bot API
    console.log(`[Telegram] Fetching for user ${userId}...`)
    return []
  }
}
