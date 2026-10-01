'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Zap, RefreshCcw, ExternalLink, ShieldAlert, GitMerge, ArrowRight, Filter } from 'lucide-react'
import { motion } from 'framer-motion'

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
  summary: { status: string; summary_json: string[]; model?: string } | null
}

type Resp = { items: HighlightItem[]; clusters: Record<string, Cluster> }

/* ─── Categories ──────────────────────────────────────────────── */
const CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'summaries', label: 'NEWS' },
  { id: 'urgent', label: 'URGENT' },
  { id: 'people', label: 'PEOPLE' },
  { id: 'discovery', label: 'DISCOVERY' },
]

const fetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('fetch_failed'))))

function timeAgo(ts: string | null) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}M AGO`
  if (h < 24) return `${h}H AGO`
  return `${Math.floor(h / 24)}D AGO`
}

/* ─── Source badge ─────────────────────────────────────────────── */
function SourceBadge({ source, isMock }: { source: string; isMock: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 font-pixel text-xs px-2 py-1 uppercase ${
      isMock ? 'bg-white/10 text-white/50 border border-white/20' : 'bg-neo-lavender text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]'
    }`}>
      {isMock && <span>~</span>}
      {source}
      {isMock && <span>[MOCK]</span>}
    </span>
  )
}

/* ─── Single standalone highlight card ───────────────────────── */
function HighlightCard({ item }: { item: HighlightItem }) {
  const isMock = item.source_type.endsWith('_mock')
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="break-inside-avoid mb-6 rounded-none border-4 border-white/20 bg-neo-black p-5 hover:border-neo-lavender transition-colors shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] hover:shadow-neo-lavender"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-4 border-white/10 pb-3">
          <SourceBadge source={item.source} isMock={isMock} />
          <span className="font-pixel text-xs text-white/40">{timeAgo(item.timestamp)}</span>
        </div>
        <div className="space-y-2">
          {item.title && <h3 className="font-sans text-xl font-bold text-white uppercase leading-snug">{item.title}</h3>}
          {item.text && !item.title && <p className="font-sans text-sm text-white/80">{item.text}</p>}
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start flex items-center gap-2 font-pixel text-xs border-2 border-neo-lavender bg-neo-purple text-neo-lavender px-3 py-2 neo-press shadow-[2px_2px_0px_0px_var(--color-neo-lavender)]"
          >
            SOURCE <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {item.why && <p className="font-sans text-xs text-white/50 border-t-2 border-white/10 pt-3 mt-4">{item.why}</p>}
    </motion.article>
  )
}

/* ─── Cluster / story card ────────────────────────────────────── */
function ClusterCard({ cluster, items }: { cluster: Cluster; items: HighlightItem[] }) {
  const hasSummary = cluster.summary?.status === 'ready' && (cluster.summary.summary_json?.length ?? 0) > 0
  const sources = cluster.trail ?? []

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="break-inside-avoid mb-6 flex flex-col border-4 bg-neo-black transition-colors"
      style={{
        borderColor: cluster.is_breaking ? 'var(--color-neo-lime)' : 'rgba(255,255,255,0.2)',
        boxShadow: cluster.is_breaking ? '6px 6px 0px 0px var(--color-neo-lime)' : '6px 6px 0px 0px rgba(255,255,255,0.1)'
      }}
    >
      {/* Header */}
      <div className="bg-neo-purple border-b-4 border-inherit p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {cluster.is_breaking && (
            <span className="flex items-center gap-1 border-2 border-neo-lime bg-neo-lime px-2 py-1 font-pixel text-xs text-black shadow-[2px_2px_0px_0px_#000]">
              <Zap className="w-3 h-3" /> BREAKING
            </span>
          )}
          {cluster.has_conflict && (
            <span className="flex items-center gap-1 border-2 border-[#ef4444] bg-[#ef4444] px-2 py-1 font-pixel text-xs text-white shadow-[2px_2px_0px_0px_#000]">
              <ShieldAlert className="w-3 h-3" /> CONFLICT
            </span>
          )}
          <span className="font-pixel text-xs text-neo-lavender bg-black/40 px-2 py-1 border border-black">
            {cluster.source_count} SRC // {cluster.independent_source_count} INDEP
          </span>
        </div>
        <h3 className="font-sans text-xl font-bold text-white uppercase leading-tight">{cluster.title}</h3>
      </div>

      {/* Summary bullets */}
      <div className="p-5 flex-1">
        {hasSummary ? (
          <ul className="space-y-3">
            {cluster.summary!.summary_json.map((bullet, i) => (
              <li key={i} className="flex gap-3 font-sans text-sm text-white/90 leading-relaxed">
                <span className="mt-1.5 w-2 h-2 border border-neo-lime bg-neo-lime flex-shrink-0" />
                {typeof bullet === 'string' ? bullet : (bullet as {text?: string}).text ?? ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-pixel text-sm text-neo-lavender uppercase animate-pulse">PROCESSING INTEL...</p>
        )}
      </div>

      {/* Source trail */}
      {sources.length > 0 && (
        <div className="border-t-4 border-white/10 bg-white/5 p-4">
          <p className="font-pixel text-xs text-white/50 uppercase mb-3 flex items-center gap-2">
            <GitMerge className="w-4 h-4" /> SOURCE TRAIL
          </p>
          <div className="space-y-2">
            {sources.map((t, i) => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <SourceBadge source={t.source} isMock={false} />
                  <span className="font-pixel text-xs text-white/30">{timeAgo(t.timestamp ?? null)}</span>
                </div>
                {t.url && (
                  <a href={t.url} target="_blank" rel="noopener noreferrer"
                    className="font-pixel text-xs text-neo-lavender opacity-0 group-hover:opacity-100 transition-opacity border-b-2 border-neo-lavender">
                    READ
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deep dive link */}
      <div className="border-t-4 border-white/10 p-4">
        <Link
          href={`/cluster/${cluster.id}`}
          className="flex items-center justify-between font-pixel text-xs text-neo-lime uppercase hover:text-white transition-colors group"
        >
          <span>FULL STORY + TIMELINE</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </motion.article>
  )
}

/* ─── Main component ──────────────────────────────────────────── */
export function Highlights() {
  const [activeCategory, setActiveCategory] = useState('all')

  const apiUrl = activeCategory === 'all'
    ? '/api/items?limit=50'
    : `/api/items?category=${activeCategory}&limit=50`

  const {
    data: itemsData, isLoading, mutate: refreshItems,
  } = useSWR<Resp>(apiUrl, fetcher, { refreshInterval: 60000 })

  const {
    data: forYouData, mutate: refreshForYou,
  } = useSWR<Resp>('/api/for-you?limit=30', fetcher, { refreshInterval: 60000 })

  const [refreshing, setRefreshing] = useState(false)

  async function refreshNews() {
    setRefreshing(true)
    await fetch('/api/rss/refresh', { method: 'POST' }).catch(() => null)
    await Promise.all([refreshItems(), refreshForYou()])
    setRefreshing(false)
  }

  // Merge & deduplicate
  const allItems = [...(itemsData?.items ?? []), ...(activeCategory === 'all' ? (forYouData?.items ?? []) : [])]
  const allClusters = { ...(itemsData?.clusters ?? {}), ...(forYouData?.clusters ?? {}) }

  const seenItemIds = new Set<string>()
  const seenClusterIds = new Set<string>()
  const highlights = allItems
    .sort((a, b) => (b.timestamp ? Date.parse(b.timestamp) : 0) - (a.timestamp ? Date.parse(a.timestamp) : 0))
    .flatMap<{ type: 'cluster'; cluster: Cluster; items: HighlightItem[] } | { type: 'item'; item: HighlightItem }>((item) => {
      if (seenItemIds.has(item.id)) return []
      seenItemIds.add(item.id)
      const cluster = item.cluster_id ? allClusters[item.cluster_id] : null
      if (cluster) {
        if (seenClusterIds.has(cluster.id)) return []
        seenClusterIds.add(cluster.id)
        return [{ type: 'cluster' as const, cluster, items: allItems.filter((c) => c.cluster_id === cluster.id) }]
      }
      return [{ type: 'item' as const, item }]
    })
    .slice(0, 30)

  return (
    <div className="min-h-[calc(100vh-64px)] bg-neo-black text-white font-sans">
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-4 border-white/10 pb-6">
          <div>
            <h1 className="font-pixel text-4xl text-white uppercase">SYNTHESIZED INTEL</h1>
            <p className="mt-3 font-sans text-lg text-white/50">Personalized information, filtered and compressed.</p>
          </div>
          <button
            onClick={refreshNews}
            disabled={refreshing}
            className="flex-shrink-0 flex items-center justify-center gap-3 border-4 border-black bg-neo-lime px-6 py-3 font-pixel text-xl text-black uppercase neo-press shadow-neo-lavender disabled:opacity-50"
          >
            <RefreshCcw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'SYNCING...' : 'REFRESH'}
          </button>
        </div>

        {/* Category filter tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          <Filter className="w-4 h-4 text-white/40 mr-2" />
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`font-pixel text-sm px-4 py-2 uppercase border-2 transition-colors neo-press ${
                activeCategory === cat.id
                  ? 'bg-neo-lime text-black border-black shadow-[3px_3px_0px_0px_#000]'
                  : 'bg-transparent text-white/60 border-white/20 hover:border-white/50 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 border-4 border-white/10 bg-white/5 animate-pulse break-inside-avoid mb-6" />
            ))}
          </div>
        )}

        {/* Masonry grid */}
        {!isLoading && highlights.length > 0 && (
          <section>
            <div className="columns-1 md:columns-2 xl:columns-3 gap-6">
              {highlights.map((entry) =>
                entry.type === 'cluster'
                  ? <ClusterCard key={entry.cluster.id} cluster={entry.cluster} items={entry.items} />
                  : <HighlightCard key={entry.item.id} item={entry.item} />
              )}
            </div>
          </section>
        )}

        {!isLoading && highlights.length === 0 && (
          <div className="border-4 border-dashed border-white/20 p-16 text-center space-y-4">
            <p className="font-pixel text-2xl text-white/40 uppercase">NO INTEL DETECTED.</p>
            <p className="font-sans text-white/30 uppercase tracking-widest">Execute refresh to fetch data streams.</p>
          </div>
        )}
      </div>
    </div>
  )
}
