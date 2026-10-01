'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Zap, RefreshCcw, ExternalLink, ShieldAlert, GitMerge, ArrowRight, Filter, Radio, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  is_low_priority: boolean
}

type Cluster = {
  id: string
  title: string
  source_count: number
  independent_source_count: number
  has_conflict: boolean
  is_breaking: boolean
  trail: { source: string; url?: string | null; timestamp?: string | null }[]
  summary: { status: string; summary_json: ({ text: string } | string)[]; model?: string } | null
}

type Resp = { items: HighlightItem[]; clusters: Record<string, Cluster> }

/* ─── Categories ──────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'all',       label: 'ALL',       color: 'neo-lime'    },
  { id: 'summaries', label: 'NEWS',      color: 'neo-lavender' },
  { id: 'urgent',    label: 'URGENT',    color: '[#ef4444]'   },
  { id: 'people',    label: 'PEOPLE',    color: 'neo-lime'    },
  { id: 'for_you',   label: 'FOR YOU',   color: 'neo-lavender' },
] as const

const fetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('fetch_failed'))))

function timeAgo(ts: string | null) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function summaryText(bullet: { text: string } | string): string {
  if (typeof bullet === 'string') return bullet
  return bullet.text ?? ''
}

/* ─── Pin card for a standalone item ─────────────────────────── */
function ItemPin({ item, index }: { item: HighlightItem; index: number }) {
  const isMock = item.source_type.endsWith('_mock')

  // Vary accent color by source type for visual interest
  const accent = item.category === 'urgent' ? '#ef4444'
    : item.source_type === 'gmail' ? '#D2CBFE'
    : item.source_type.includes('reddit') ? '#ff6314'
    : '#CDFC8A'

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 280, damping: 24 }}
      className="break-inside-avoid mb-5 group relative cursor-pointer"
    >
      <div
        className="border-4 border-black bg-neo-black overflow-hidden transition-all duration-150 group-hover:-translate-y-1"
        style={{ boxShadow: `5px 5px 0px 0px ${accent}` }}
      >
        {/* Color bar at top */}
        <div className="h-1.5" style={{ backgroundColor: accent }} />

        <div className="p-5 space-y-3">
          {/* Meta row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className="font-pixel text-[10px] px-2 py-1 uppercase border-2 border-black"
              style={{ backgroundColor: accent, color: '#000' }}
            >
              {isMock ? `${item.source} [mock]` : item.source}
            </span>
            <span className="font-pixel text-[10px] text-white/30">{timeAgo(item.timestamp)}</span>
          </div>

          {/* Title */}
          {item.title && (
            <h3 className="font-sans font-bold text-white text-base leading-snug uppercase">
              {item.title}
            </h3>
          )}

          {/* Text (only when no title) */}
          {!item.title && item.text && (
            <p className="font-sans text-sm text-white/70 leading-relaxed line-clamp-4">
              {item.text}
            </p>
          )}

          {/* Why label */}
          {item.why && (
            <p className="font-sans text-xs text-white/40 border-l-4 border-white/10 pl-3 leading-relaxed">
              {item.why}
            </p>
          )}

          {/* Footer */}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 font-pixel text-[10px] uppercase border-2 border-white/20 px-2 py-1 text-white/60 hover:border-white hover:text-white transition-colors"
            >
              SOURCE <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </motion.article>
  )
}

/* ─── Pin card for a cluster ──────────────────────────────────── */
function ClusterPin({ cluster, index }: { cluster: Cluster; index: number }) {
  const hasSummary =
    cluster.summary?.status === 'ready' &&
    (cluster.summary.summary_json?.length ?? 0) > 0

  const accent = cluster.is_breaking ? '#CDFC8A'
    : cluster.has_conflict ? '#ef4444'
    : '#D2CBFE'

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 280, damping: 24 }}
      className="break-inside-avoid mb-5 group relative"
    >
      <div
        className="border-4 border-black bg-neo-purple overflow-hidden transition-all duration-150 group-hover:-translate-y-1"
        style={{ boxShadow: `5px 5px 0px 0px ${accent}` }}
      >
        {/* Color bar */}
        <div className="h-1.5" style={{ backgroundColor: accent }} />

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b-4 border-black/30 space-y-3">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {cluster.is_breaking && (
              <span className="flex items-center gap-1 font-pixel text-[10px] bg-neo-lime text-black border-2 border-black px-2 py-0.5 shadow-[2px_2px_0px_0px_#000]">
                <Zap className="w-2.5 h-2.5" /> BREAKING
              </span>
            )}
            {cluster.has_conflict && (
              <span className="flex items-center gap-1 font-pixel text-[10px] bg-[#ef4444] text-white border-2 border-black px-2 py-0.5 shadow-[2px_2px_0px_0px_#000]">
                <ShieldAlert className="w-2.5 h-2.5" /> CONFLICT
              </span>
            )}
            <span className="font-pixel text-[10px] text-white/50">
              {cluster.source_count} SRC
            </span>
          </div>
          {/* Title */}
          <h3 className="font-sans font-bold text-white text-base leading-snug uppercase">
            {cluster.title}
          </h3>
        </div>

        {/* Summary */}
        <div className="px-5 py-4 space-y-2.5">
          {hasSummary ? (
            cluster.summary!.summary_json.slice(0, 3).map((bullet, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className="mt-1.5 w-2 h-2 flex-shrink-0 border-2 border-black"
                  style={{ backgroundColor: accent }}
                />
                <p className="font-sans text-sm text-white/85 leading-relaxed">
                  {summaryText(bullet)}
                </p>
              </div>
            ))
          ) : (
            <p className="font-pixel text-[11px] text-white/40 uppercase animate-pulse">
              SYNTHESIZING...
            </p>
          )}
        </div>

        {/* Source trail */}
        {cluster.trail?.length > 0 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {cluster.trail.slice(0, 4).map((t, i) => (
              <span
                key={i}
                className="font-pixel text-[9px] bg-black/40 text-white/50 border border-white/10 px-2 py-1 uppercase"
              >
                {t.source}
              </span>
            ))}
          </div>
        )}

        {/* Footer link */}
        <Link
          href={`/cluster/${cluster.id}`}
          className="flex items-center justify-between px-5 py-3 border-t-4 border-black/30 font-pixel text-[10px] uppercase group/link"
          style={{ color: accent }}
        >
          <span className="group-hover/link:underline">FULL STORY</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
        </Link>
      </div>
    </motion.article>
  )
}

/* ─── Main export ─────────────────────────────────────────────── */
export function Highlights() {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  const apiUrl = activeCategory === 'all'
    ? '/api/items?limit=60&includeLow=true'
    : `/api/items?category=${activeCategory}&limit=60&includeLow=true`

  const {
    data: itemsData,
    isLoading,
    mutate: refreshItems,
  } = useSWR<Resp>(apiUrl, fetcher, { refreshInterval: 60_000 })

  const {
    data: forYouData,
    mutate: refreshForYou,
  } = useSWR<Resp>(
    activeCategory === 'all' ? '/api/for-you?limit=30' : null,
    fetcher,
    { refreshInterval: 60_000 }
  )

  async function handleRefresh() {
    setRefreshing(true)
    await fetch('/api/rss/refresh', { method: 'POST' }).catch(() => null)
    await Promise.all([refreshItems(), refreshForYou?.()])
    setRefreshing(false)
  }

  /* ── Merge & dedupe ── */
  const allItems = [
    ...(itemsData?.items ?? []),
    ...(activeCategory === 'all' ? (forYouData?.items ?? []) : []),
  ]
  const allClusters = {
    ...(itemsData?.clusters ?? {}),
    ...(forYouData?.clusters ?? {}),
  }

  const seenItemIds = new Set<string>()
  const seenClusterIds = new Set<string>()

  type PinEntry =
    | { type: 'cluster'; cluster: Cluster; key: string }
    | { type: 'item'; item: HighlightItem; key: string }

  const pins: PinEntry[] = allItems
    .sort(
      (a, b) =>
        (b.importance_score - a.importance_score) ||
        (b.timestamp ? Date.parse(b.timestamp) : 0) - (a.timestamp ? Date.parse(a.timestamp) : 0)
    )
    .flatMap<PinEntry>((item) => {
      if (seenItemIds.has(item.id)) return []
      seenItemIds.add(item.id)
      const cluster = item.cluster_id ? allClusters[item.cluster_id] : null
      if (cluster) {
        if (seenClusterIds.has(cluster.id)) return []
        seenClusterIds.add(cluster.id)
        return [{ type: 'cluster', cluster, key: cluster.id }]
      }
      return [{ type: 'item', item, key: item.id }]
    })
    .slice(0, 40)

  return (
    <div className="min-h-[calc(100vh-64px)] bg-neo-black text-white font-sans">
      {/* ── Sticky toolbar ── */}
      <div className="sticky top-16 z-30 border-b-4 border-white/10 bg-neo-black/95 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          {/* Category tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-white/30 mr-1 flex-shrink-0" />
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`font-pixel text-xs px-3 py-2 uppercase border-2 transition-all neo-press ${
                    isActive
                      ? 'bg-neo-lime text-black border-black shadow-[3px_3px_0px_0px_#000]'
                      : 'bg-transparent text-white/50 border-white/20 hover:border-white/50 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>

          {/* Right side: count + refresh */}
          <div className="flex items-center gap-4">
            <span className="font-pixel text-xs text-white/30">
              {pins.length} PINS
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 border-4 border-black bg-neo-lime px-4 py-2 font-pixel text-sm text-black uppercase neo-press shadow-[3px_3px_0px_0px_#000] disabled:opacity-50"
            >
              <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'SYNCING' : 'REFRESH'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Main board ── */}
      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-pixel text-3xl text-white uppercase">
            INTEL BOARD
          </h1>
          <p className="mt-2 font-sans text-sm text-white/40">
            {activeCategory === 'all'
              ? 'All incoming signals, clustered and prioritized'
              : CATEGORIES.find((c) => c.id === activeCategory)?.label + ' feed'}
          </p>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="break-inside-avoid mb-4 border-4 border-white/10 bg-white/5 animate-pulse"
                style={{ height: `${120 + (i % 4) * 60}px` }}
              />
            ))}
          </div>
        )}

        {/* Pinterest masonry board */}
        {!isLoading && pins.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4"
            >
              {pins.map((pin, i) =>
                pin.type === 'cluster' ? (
                  <ClusterPin key={pin.key} cluster={pin.cluster} index={i} />
                ) : (
                  <ItemPin key={pin.key} item={pin.item} index={i} />
                )
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Empty state */}
        {!isLoading && pins.length === 0 && (
          <div className="border-4 border-dashed border-white/15 p-20 text-center space-y-5">
            <div className="font-pixel text-6xl text-white/10">[ ]</div>
            <p className="font-pixel text-xl text-white/30 uppercase">NO PINS IN THIS FEED.</p>
            <p className="font-sans text-sm text-white/20">
              {activeCategory === 'all'
                ? 'Click REFRESH to fetch live RSS data.'
                : `No ${CATEGORIES.find((c) => c.id === activeCategory)?.label} items yet. Try the ALL tab.`}
            </p>
            {activeCategory === 'all' && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="mx-auto mt-4 flex items-center gap-2 border-4 border-black bg-neo-lime px-6 py-3 font-pixel text-sm text-black uppercase neo-press shadow-[4px_4px_0px_0px_#000] disabled:opacity-50"
              >
                <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                FETCH DATA STREAMS
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
