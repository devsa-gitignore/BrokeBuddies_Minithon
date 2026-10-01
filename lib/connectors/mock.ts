import type { Connector } from './types'
import type { RawItem } from '@/types/domain'

const min = (now: Date, m: number) => new Date(now.getTime() + m * 60_000).toISOString()

export const mockNewsConnector: Connector = {
  name: 'Mock News',
  sourceType: 'article_mock',
  async fetchItems(userId: string): Promise<RawItem[]> {
    const now = new Date()
    return ['Reuters', 'BBC Sport', 'Autosport'].map((p, i) => ({
      externalId: `mock-news-f1-${i}`,
      source: `${p} (mock)`,
      sourceType: 'article_mock',
      title: `Verstappen to leave Red Bull at the end of the season, reports say${i === 2 ? ' - team denies' : ''}`,
      text: 'Reports emerged of a driver move.',
      url: `https://example.com/mock/f1-${i}`,
      timestamp: min(now, -40 + i * 8),
      metadata: { 
        clusterHint: 'f1-move', 
        ...(i === 0 ? { claimKey: 'departure', claim: 'confirmed' } : i === 2 ? { claimKey: 'departure', claim: 'denied' } : {}) 
      },
    }))
  }
}

export const mockRedditConnector: Connector = {
  name: 'Mock Reddit',
  sourceType: 'reddit_mock',
  async fetchItems(userId: string): Promise<RawItem[]> {
    const now = new Date()
    return [
      {
        externalId: 'mock-rd-1',
        source: 'Reddit r/startups (mock)',
        sourceType: 'reddit_mock',
        title: 'How we got our first 100 customers without ads',
        url: 'https://example.com/mock/rd-1',
        timestamp: min(now, -90),
        engagement: { upvotes: 820, comments: 140 },
        metadata: {}
      }
    ]
  }
}

export const mockInstagramConnector: Connector = {
  name: 'Mock Instagram',
  sourceType: 'instagram_mock',
  async fetchItems(userId: string): Promise<RawItem[]> {
    const now = new Date()
    return [
      { 
        externalId: 'mock-ig-1', 
        source: 'Instagram (mock)', 
        sourceType: 'instagram_mock', 
        sender: 'travel.daily', 
        senderIdentifier: 'travel.daily', 
        timestamp: min(now, -15), 
        metadata: { platform: 'instagram', appName: 'Instagram', notificationType: 'message' } 
      }
    ]
  }
}

export const mockXConnector: Connector = {
  name: 'Mock X',
  sourceType: 'x_mock',
  async fetchItems(userId: string): Promise<RawItem[]> {
    const now = new Date()
    return [
      {
        externalId: 'mock-x-1',
        source: 'X (mock)',
        sourceType: 'x_mock',
        sender: 'indie_hacker',
        title: 'Shipping small every day beats big launches. Thread.',
        url: 'https://example.com/mock/x-1',
        timestamp: min(now, -75),
        engagement: { likes: 310, reposts: 40 },
        metadata: {}
      }
    ]
  }
}

export const mockMessagesConnector: Connector = {
  name: 'Mock Messages',
  sourceType: 'phone_notification',
  async fetchItems(userId: string): Promise<RawItem[]> {
    const now = new Date()
    return [0, 12, 25, 41].map((m, i) => ({
      externalId: `mock-wa-rep-${i}`,
      source: 'Phone notifications (mock)',
      sourceType: 'phone_notification',
      sender: 'Maya',
      senderIdentifier: 'maya-wa',
      timestamp: min(now, -55 + m),
      metadata: { platform: 'whatsapp', appName: 'WhatsApp', notificationType: 'message' },
    }))
  }
}

export const mockPhoneConnector: Connector = {
  name: 'Mock Phone Calls',
  sourceType: 'phone_notification',
  async fetchItems(userId: string): Promise<RawItem[]> {
    const now = new Date()
    return [
      {
        externalId: 'mock-call-1',
        source: 'Phone notifications (mock)',
        sourceType: 'phone_notification',
        sender: 'Unknown +44 7700 900123',
        senderIdentifier: '+447700900123',
        timestamp: min(now, -10),
        metadata: { platform: 'phone', appName: 'Phone', notificationType: 'missed_call' }
      }
    ]
  }
}
