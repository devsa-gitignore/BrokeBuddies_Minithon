'use client'

import { Check, ExternalLink, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type FeedItem = {
  id: string
  source: string
  source_type: string
  sender: string | null
  timestamp: string | null
  title: string | null
  text: string | null
  url: string | null
  category: 'people' | 'urgent' | 'summaries' | 'for_you'
  importance_score: number
  why: string | null
  act_by: string | null
  urgency_evidence: string | null
  is_overdue: boolean
  is_mock: boolean
  people_kind: 'priority' | 'repeat' | 'missed_call' | 'ordinary' | null
  cluster_id: string | null
  is_read: boolean
  metadata: Record<string, unknown>
}

export function timeLabel(iso: string | null, tz?: string) {
  if (!iso) return 'Time unknown'
  return new Date(iso).toLocaleString(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })
}

export function FeedbackButtons({ id, onDone }: { id: string; onDone: () => void }) {
  async function send(action: string) {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: id, action }),
    })
    onDone()
  }
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" aria-label="Mark important" onClick={() => send('important')}>
        <ThumbsUp className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Mark not important" onClick={() => send('not_important')}>
        <ThumbsDown className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Mark read" onClick={() => send('read')}>
        <Check className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={() => send('dismiss')}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

export function ItemCard({ item, onChange }: { item: FeedItem; onChange: () => void }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">
            {item.source}
            {item.sender ? ` · ${item.sender}` : ''} · {timeLabel(item.timestamp)}
            {item.is_mock && <span className="ml-2 rounded bg-muted px-1.5 py-0.5">Demo</span>}
          </p>
          <h3 className={`text-sm font-medium text-pretty ${item.is_read ? 'text-muted-foreground' : ''}`}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                {item.title ?? 'Untitled'}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : (
              (item.title ?? item.sender ?? 'Notification')
            )}
          </h3>
          {item.act_by && (
            <p className={`text-xs ${item.is_overdue ? 'text-destructive' : 'text-foreground'}`}>
              {item.is_overdue ? 'Overdue - ' : 'Act by '}
              {timeLabel(item.act_by)}
              {item.urgency_evidence ? ` (from "${item.urgency_evidence}")` : ''}
            </p>
          )}
          {item.why && <p className="text-xs text-muted-foreground">Why: {item.why}</p>}
        </div>
        <FeedbackButtons id={item.id} onDone={onChange} />
      </div>
    </article>
  )
}
