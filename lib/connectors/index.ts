export * from './types'
export * from './mock'
export * from './scaffold'

import {
  mockNewsConnector,
  mockRedditConnector,
  mockInstagramConnector,
  mockXConnector,
  mockMessagesConnector,
  mockPhoneConnector
} from './mock'

import {
  rssConnector,
  gmailConnector,
  telegramConnector
} from './scaffold'

export const allConnectors = [
  mockNewsConnector,
  mockRedditConnector,
  mockInstagramConnector,
  mockXConnector,
  mockMessagesConnector,
  mockPhoneConnector,
  rssConnector,
  gmailConnector,
  telegramConnector
]
