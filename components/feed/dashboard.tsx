'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FeedbackButtons, ItemCard, timeLabel, type FeedItem } from './item-card'

type Cluster = {
  id: string
  title: string
  source_count: number
  independent_source_count: number
  has_conflict: boolean
  is_breaking: boolean
  trail: { source: string; url?: string | null; timestamp?: string | null; role?: string }[]
  summary: { status: string; summary_json: string[] } | null
}

type Resp = { items: FeedItem[]; clusters: Record<string, Cluster> }

const TABS = [
  { key: 'urgent', label: 'Urgent', empty: 'Nothing urgent. You can relax.' },
  { key: 'people', label: 'People', empty: 'No messages from people right now.' },
  { key: 'summaries', label: 'Summaries', empty: 'No stories to summarise yet.' },
  { key: 'for_you', label: 'For You', empty: 'Nothing matched your interests yet.' },
] as const

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Request failed'))))

export function Dashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('urgent')
  const { data, error, isLoading, mutate } = useSWR<Resp>('/api/items?limit=100', fetcher, { refreshInterval: 30000 })
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function run(kind: 'seed' | 'rss') {
    setBusy(kind)
    setNote(null)
    const res = await fetch(kind === 'seed' ? '/api/seed' : '/api/rss/refresh', { method: 'POST' })
    const j = await res.json().catch(() => ({}))
    setNote(res.ok ? `Added ${j.created ?? 0} new, ${j.duplicate ?? 0} already present.` : 'Something went wrong. Try again.')
    setBusy(null)
    mutate()
  }

  const items = (data?.items ?? []).filter((i) => i.category === tab)
  const counts = Object.fromEntries(TABS.map((t) => [t.key, (data?.items ?? []).filter((i) => i.category === t.key).length]))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Feeds" className="flex gap-1 rounded-lg bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm text-muted-foreground',
                tab === t.key && 'bg-background text-foreground shadow-sm',
              )}
            >
              {t.label} <span className="text-xs opacity-70">{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => run('rss')}>
            {busy === 'rss' ? 'Fetching...' : 'Refresh news'}
          </Button>
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => run('seed')}>
            {busy === 'seed' ? 'Loading...' : 'Load demo data'}
          </Button>
        </div>
      </div>
      {note && (
        <p role="status" className="text-sm text-muted-foreground">
          {note}
        </p>
      )}

      <section role="tabpanel" className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-destructive">Could not load your feed.</p>}
        {!isLoading && !error && items.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {TABS.find((t) => t.key === tab)?.empty}
          </p>
        )}
        {tab === 'people' ? (
          <PeopleFeed items={items} onChange={() => mutate()} />
        ) : tab === 'summaries' ? (
          <SummaryFeed items={items} clusters={data?.clusters ?? {}} onChange={() => mutate()} />
        ) : (
          items.map((i) => <ItemCard key={i.id} item={i} onChange={() => mutate()} />)
        )}
      </section>
    </div>
  )
}

function PeopleFeed({ items, onChange }: { items: FeedItem[]; onChange: () => void }) {
  const special = items.filter((i) => i.people_kind && i.people_kind !== 'ordinary')
  const ordinary = items.filter((i) => !i.people_kind || i.people_kind === 'ordinary')

  const byRepeat = new Map<string, FeedItem[]>()
  const singles: FeedItem[] = []
  for (const i of special) {
    if (i.people_kind === 'repeat') byRepeat.set(i.sender ?? '?', [...(byRepeat.get(i.sender ?? '?') ?? []), i])
    else singles.push(i)
  }
  const chats = new Set(ordinary.map((i) => i.sender ?? '?'))

  return (
    <>
      {singles.map((i) => (
        <ItemCard key={i.id} item={i} onChange={onChange} />
      ))}
      {[...byRepeat.entries()].map(([sender, list]) => (
        <article key={sender} className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium">
            {sender} messaged {list.length} times
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Latest {timeLabel(list[0].timestamp)} · {list[0].source}. Repeat messages from one person are a stronger signal than one.
          </p>
        </article>
      ))}
      {ordinary.length > 0 && (
        <details className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {ordinary.length} other message{ordinary.length === 1 ? '' : 's'} from {chats.size} chat{chats.size === 1 ? '' : 's'}
          </summary>
          <ul className="mt-3 space-y-2">
            {ordinary.map((i) => (
              <li key={i.id} className="flex items-center justify-between text-sm">
                <span>
                  {i.sender ?? 'Unknown'} <span className="text-xs text-muted-foreground">· {i.source} · {timeLabel(i.timestamp)}</span>
                </span>
                <FeedbackButtons id={i.id} onDone={onChange} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

function SummaryFeed({ items, clusters, onChange }: { items: FeedItem[]; clusters: Record<string, Cluster>; onChange: () => void }) {
  const seen = new Set<string>()
  return (
    <>
      {items.map((i) => {
        const c = i.cluster_id ? clusters[i.cluster_id] : null
        if (!c) return <ItemCard key={i.id} item={i} onChange={onChange} />
        if (seen.has(c.id)) return null
        seen.add(c.id)
        return (
          <article key={c.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex flex-wrap gap-2 text-xs">
                  {c.is_breaking && <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-destructive">Breaking</span>}
                  {c.has_conflict && <span className="rounded bg-muted px-1.5 py-0.5">Sources disagree</span>}
                  <span className="text-muted-foreground">
                    {c.source_count} source{c.source_count === 1 ? '' : 's'} ({c.independent_source_count} independent)
                  </span>
                </div>
                <h3 className="text-sm font-medium text-pretty">{c.title}</h3>
              </div>
              <FeedbackButtons id={i.id} onDone={onChange} />
            </div>
            {c.summary?.status === 'ready' && c.summary.summary_json.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {c.summary.summary_json.map((b, n) => (
                  <li key={n}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Summary unavailable. Showing source headlines.</p>
            )}
            {i.why && <p className="text-xs text-muted-foreground">Why: {i.why}</p>}
            <ul className="space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
              {c.trail.map((t, n) => (
                <li key={n}>
                  {t.url ? (
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {t.source}
                    </a>
                  ) : (
                    t.source
                  )}
                  {t.timestamp ? ` · ${timeLabel(t.timestamp)}` : ''}
                  {t.role ? ` · ${t.role}` : ''}
                </li>
              ))}
            </ul>
          </article>
        )
      })}
    </>
  )
}
