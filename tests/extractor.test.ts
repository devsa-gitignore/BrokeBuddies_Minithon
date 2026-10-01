import { describe, expect, it } from 'vitest'
import { isBlockedHost } from '@/lib/workspaces/extractor'

describe('isBlockedHost', () => {
  it('blocks loopback, private, link-local and metadata hosts', () => {
    const blocked = [
      'localhost',
      'ip6-localhost',
      'foo.localhost',
      'metadata.google.internal',
      'printer.local',
      '0.0.0.0',
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '[::1]',
      'fe80::1',
      'fd00:ec2::254',
      '::ffff:10.0.0.1',
    ]
    for (const host of blocked) {
      expect(isBlockedHost(host), host).toBe(true)
    }
  })

  it('allows public hosts and near-miss ranges', () => {
    const allowed = [
      'example.com',
      'news.ycombinator.com',
      '8.8.8.8',
      '1.1.1.1',
      '172.32.0.1',
      '172.15.255.255',
      '100.128.0.1',
      'fe80.example.com',
      'fcbarcelona.com',
    ]
    for (const host of allowed) {
      expect(isBlockedHost(host), host).toBe(false)
    }
  })
})
