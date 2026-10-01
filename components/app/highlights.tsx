'use client'

import { useState } from 'react'
import useSWR from 'swr'

/* ─── Types ──────────────────────────────────────────────────── */
type HighlightItem = {
  id: string
  source: string
  source_type: string
  title: string | null
  text: string | null
  url: string | null
  category: string
  importance_score: number
  relevance_score: number
  timestamp: string | null
  why: string | null
  cluster_id: string | null
}

type Cluster = {
  id: string
  title: string
  source_count: number
  independent_source_count: number
  has_conflict: boolean
  is_breaking: boolean
  trail: { source: string; url?: string | null; timestamp?: string | null }[]
  summary: { status: string; summary_json: string[] } | null
}

type Resp = { items: HighlightItem[]; clusters: Record<string, Cluster> }

const fetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('fetch_failed'))))

function timeAgo(ts: string | null) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ─── Source badge ─────────────────────────────────────────────── */
function SourceBadge({ source, isMock }: { source: string; isMock: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
      isMock ? 'border border-white/10 text-white/30' : 'border border-violet-500/30 bg-violet-500/10 text-violet-300'
    }`}>
      {isMock && <span className="text-white/20">~</span>}
      {source}
      {isMock && <span className="text-white/20">mock</span>}
    </span>
  )
}

/* ─── Single standalone highlight card ───────────────────────── */
function HighlightCard({ item }: { item: HighlightItem }) {
  const isMock = item.source_type.endsWith('_mock')
  return (
    <article className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={item.source} isMock={isMock} />
            <span className="text-xs text-white/30">{timeAgo(item.timestamp)}</span>
          </div>
          {item.title && <h3 className="text-sm font-medium text-white leading-snug">{item.title}</h3>}
          {item.text && !item.title && <p className="text-sm text-white/70 line-clamp-3">{item.text}</p>}
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white hover:border-white/30 transition-colors"
          >
            Read →
          </a>
        )}
      </div>
      {item.why && <p className="text-xs text-white/35 border-t border-white/5 pt-3">{item.why}</p>}
    </article>
  )
}

/* ─── Cluster / story card ────────────────────────────────────── */
function ClusterCard({ cluster, items }: { cluster: Cluster; items: HighlightItem[] }) {
  const hasSummary = cluster.summary?.status === 'ready' && (cluster.summary.summary_json?.length ?? 0) > 0
  const sources = cluster.trail ?? []

  return (
    <article className="rounded-xl border bg-white/5 p-5 space-y-4 hover:border-white/20 transition-colors"
      style={{ borderColor: cluster.is_breaking ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)' }}
    >
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {cluster.is_breaking && (
            <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-400 uppercase tracking-wider">Breaking</span>
          )}
          {cluster.has_conflict && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">Sources disagree</span>
          )}
          <span className="text-xs text-white/30">
            {cluster.source_count} source{cluster.source_count !== 1 ? 's' : ''} · {cluster.independent_source_count} independent
          </span>
        </div>
        <h3 className="text-sm font-semibold text-white leading-snug">{cluster.title}</h3>
      </div>

      {/* Summary bullets */}
      {hasSummary ? (
        <ul className="space-y-1.5">
          {cluster.summary!.summary_json.map((bullet, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-white/70">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-400 flex-shrink-0" />
              {bullet}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-white/30">Summary processing…</p>
      )}

      {/* Source trail */}
      {sources.length > 0 && (
        <div className="border-t border-white/5 pt-3 space-y-1.5">
          <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Sources</p>
          {sources.map((t, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SourceBadge source={t.source} isMock={false} />
                <span className="text-xs text-white/30">{timeAgo(t.timestamp ?? null)}</span>
              </div>
              {t.url && (
                <a href={t.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  Open →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

/* ─── Main component ──────────────────────────────────────────── */
export function Highlights() {
  const {
    data: summariesData, isLoading: loadingSummaries, mutate: refreshSummaries,
  } = useSWR<Resp>('/api/items?category=summaries&limit=50', fetcher, { refreshInterval: 60000 })

  const {
    data: forYouData, isLoading: loadingForYou, mutate: refreshForYou,
  } = useSWR<HighlightItem[]>('/api/for-you', fetcher, { refreshInterval: 60000 })

  const [refreshing, setRefreshing] = useState(false)

  async function refreshNews() {
    setRefreshing(true)
    await fetch('/api/rss/refresh', { method: 'POST' }).catch(() => null)
    await Promise.all([refreshSummaries(), refreshForYou()])
    setRefreshing(false)
  }

  const summaryItems = summariesData?.items ?? []
  const clusters = summariesData?.clusters ?? {}
  const forYouItems = Array.isArray(forYouData) ? forYouData : []

  // Deduplicate cluster IDs for summaries
  const seenClusters = new Set<string>()
  const storiesAndItems = summaryItems.map((item) => {
    const cluster = item.cluster_id ? clusters[item.cluster_id] : null
    if (cluster) {
      if (seenClusters.has(cluster.id)) return null
      seenClusters.add(cluster.id)
      return { type: 'cluster' as const, cluster, items: summaryItems.filter((i) => i.cluster_id === cluster.id) }
    }
    return { type: 'item' as const, item }
  }).filter(Boolean) as ({ type: 'cluster'; cluster: Cluster; items: HighlightItem[] } | { type: 'item'; item: HighlightItem })[]

  const isLoading = loadingSummaries && loadingForYou

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Highlights</h1>
            <p className="mt-1 text-sm text-white/40">Personalized current information, refreshed for you.</p>
          </div>
          <button
            onClick={refreshNews}
            disabled={refreshing}
            className="flex-shrink-0 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* Stories & summaries */}
        {storiesAndItems.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Stories</h2>
            {storiesAndItems.map((entry, i) =>
              entry.type === 'cluster'
                ? <ClusterCard key={entry.cluster.id} cluster={entry.cluster} items={entry.items} />
                : <HighlightCard key={entry.item.id} item={entry.item} />
            )}
          </section>
        )}

        {/* For You */}
        {forYouItems.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">For You</h2>
            {forYouItems.map((item) => (
              <HighlightCard key={item.id} item={item as HighlightItem} />
            ))}
          </section>
        )}

        {!isLoading && storiesAndItems.length === 0 && forYouItems.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 p-12 text-center space-y-3">
            <p className="text-white/30 text-sm">No highlights yet.</p>
            <p className="text-white/20 text-xs">Click Refresh to fetch the latest news from your sources.</p>
          </div>
        )}
      </div>
    </div>
  )
}
