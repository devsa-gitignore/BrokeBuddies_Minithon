'use client'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { motion } from 'framer-motion'
import { ArrowLeft, Zap, ShieldAlert, GitMerge, ExternalLink, Clock, Radio } from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────────── */
type TrailEntry = { source: string; url?: string | null; timestamp?: string | null }

type ClusterSummary = {
  status: string
  summary_json: { text: string; citationItemIds: string[] }[]
  model: string | null
  version: number
  generated_at: string | null
}

type ClusterDetail = {
  id: string
  title: string
  topic: string | null
  source_count: number
  independent_source_count: number
  has_conflict: boolean
  is_breaking: boolean
  first_seen_at: string
  last_seen_at: string
  importance_score: number
  trail: TrailEntry[]
  summary: ClusterSummary | null
}

type ItemRow = {
  id: string
  source: string
  source_type: string
  title: string | null
  text: string | null
  url: string | null
  timestamp: string | null
  importance_score: number
  why: string | null
  cluster_id: string | null
}

type ClusterResponse = { cluster: ClusterDetail; items: ItemRow[] }

const fetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('not_found'))))

function timeAgo(ts: string | null) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60_000))}M AGO`
  if (h < 24) return `${h}H AGO`
  return `${Math.floor(h / 24)}D AGO`
}

function fmtTime(ts: string | null) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(ts: string | null) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ─── Source badge ────────────────────────────────────────────── */
function SourceBadge({ source }: { source: string }) {
  return (
    <span className="font-pixel text-xs bg-neo-lavender text-black border-2 border-black px-2 py-0.5 shadow-[2px_2px_0px_0px_#000] uppercase">
      {source}
    </span>
  )
}

/* ─── Timeline item ───────────────────────────────────────────── */
function TimelineItem({ item, index }: { item: ItemRow; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 260, damping: 22 }}
      className="relative pl-8 pb-8 group"
    >
      {/* Connector line */}
      <div className="absolute left-2.5 top-0 bottom-0 w-px bg-white/10 group-last:hidden" />
      {/* Dot */}
      <div className="absolute left-0 top-1.5 w-5 h-5 border-4 border-neo-lime bg-neo-black" />

      <div className="border-4 border-white/20 bg-neo-black p-5 space-y-3 hover:border-neo-lavender transition-colors shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SourceBadge source={item.source} />
          <span className="font-pixel text-xs text-white/40">{timeAgo(item.timestamp)} · {fmtTime(item.timestamp)}</span>
        </div>
        {item.title && (
          <h3 className="font-sans text-lg font-bold text-white uppercase leading-tight">{item.title}</h3>
        )}
        {item.why && (
          <p className="font-sans text-sm text-white/60 border-l-4 border-neo-lavender pl-3">{item.why}</p>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-pixel text-xs text-neo-lavender border-2 border-neo-lavender px-3 py-1.5 hover:bg-neo-lavender hover:text-black transition-colors neo-press shadow-[2px_2px_0px_0px_var(--color-neo-lavender)]"
          >
            SOURCE <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </motion.article>
  )
}

/* ─── Main component ──────────────────────────────────────────── */
export function ClusterDetail({ id }: { id: string }) {
  const { data, error, isLoading } = useSWR<ClusterResponse>(
    `/api/clusters/${id}`,
    fetcher
  )

  if (error) notFound()

  const cluster = data?.cluster
  const items = data?.items ?? []
  const hasSummary = cluster?.summary?.status === 'ready' && (cluster.summary.summary_json?.length ?? 0) > 0

  return (
    <div className="min-h-[calc(100vh-64px)] bg-neo-black text-white font-sans">
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">

        {/* Back link */}
        <Link
          href="/highlights"
          className="inline-flex items-center gap-2 font-pixel text-sm text-white/50 hover:text-neo-lime transition-colors uppercase"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO HIGHLIGHTS
        </Link>

        {isLoading && (
          <div className="space-y-6">
            <div className="h-16 border-4 border-white/10 bg-white/5 animate-pulse" />
            <div className="h-48 border-4 border-white/10 bg-white/5 animate-pulse" />
            <div className="h-64 border-4 border-white/10 bg-white/5 animate-pulse" />
          </div>
        )}

        {cluster && (
          <>
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                {cluster.is_breaking && (
                  <span className="flex items-center gap-1.5 border-2 border-neo-lime bg-neo-lime px-3 py-1 font-pixel text-sm text-black shadow-[3px_3px_0px_0px_#000]">
                    <Zap className="w-4 h-4" /> BREAKING
                  </span>
                )}
                {cluster.has_conflict && (
                  <span className="flex items-center gap-1.5 border-2 border-[#ef4444] bg-[#ef4444] px-3 py-1 font-pixel text-sm text-white shadow-[3px_3px_0px_0px_#000]">
                    <ShieldAlert className="w-4 h-4" /> SOURCES DISAGREE
                  </span>
                )}
                {cluster.topic && (
                  <span className="border-2 border-neo-lavender bg-neo-lavender/10 text-neo-lavender px-3 py-1 font-pixel text-xs uppercase">
                    {cluster.topic}
                  </span>
                )}
              </div>

              <h1 className="font-pixel text-3xl md:text-5xl text-white uppercase leading-tight">
                {cluster.title}
              </h1>

              <div className="flex flex-wrap items-center gap-6 font-pixel text-xs text-white/50">
                <span className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-neo-lime" />
                  {cluster.source_count} SRC // {cluster.independent_source_count} INDEPENDENT
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-neo-lavender" />
                  FIRST: {fmtDate(cluster.first_seen_at)} // LAST: {fmtDate(cluster.last_seen_at)}
                </span>
              </div>
            </motion.div>

            {/* AI Summary */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border-4 border-neo-lime bg-neo-green shadow-neo-lime"
            >
              <div className="border-b-4 border-neo-lime px-6 py-3 flex items-center justify-between">
                <h2 className="font-pixel text-lg text-neo-lime uppercase">AI SYNTHESIS</h2>
                {cluster.summary?.model && (
                  <span className="font-pixel text-xs text-neo-lime/50">via {cluster.summary.model}</span>
                )}
              </div>
              <div className="p-6">
                {hasSummary ? (
                  <ul className="space-y-4">
                    {cluster.summary!.summary_json.map((sentence, i) => (
                      <li key={i} className="flex gap-4">
                        <span className="mt-1.5 w-2 h-2 border-2 border-neo-lime bg-neo-lime flex-shrink-0" />
                        <p className="font-sans text-base text-white/90 leading-relaxed">{sentence.text}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="font-pixel text-sm text-neo-lime/60 uppercase animate-pulse">
                    SYNTHESIS PROCESSING — CHECK BACK SHORTLY
                  </p>
                )}
              </div>
            </motion.section>

            {/* Conflict callout */}
            {cluster.has_conflict && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="border-4 border-[#ef4444] bg-[#ef4444]/10 p-5 flex items-start gap-4"
              >
                <ShieldAlert className="w-6 h-6 text-[#ef4444] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-pixel text-sm text-[#ef4444] uppercase">CONFLICTING REPORTS DETECTED</p>
                  <p className="font-sans text-sm text-white/70 mt-2">
                    Multiple independent sources report contradictory facts about this story. Review the full source trail below before acting on this information.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Source Trail */}
            {cluster.trail && cluster.trail.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-4 border-b-4 border-neo-lavender pb-3">
                  <h2 className="font-pixel text-xl text-neo-lavender uppercase flex items-center gap-2">
                    <GitMerge className="w-5 h-5" />
                    SOURCE TRAIL
                  </h2>
                  <span className="font-pixel text-xs text-white/40 border-2 border-white/20 px-2 py-1">
                    {cluster.trail.length} SOURCES
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {cluster.trail.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 border-4 border-white/10 bg-neo-purple px-4 py-3">
                      <div>
                        <SourceBadge source={t.source} />
                        {t.timestamp && (
                          <p className="font-pixel text-xs text-white/40 mt-1">{timeAgo(t.timestamp)}</p>
                        )}
                      </div>
                      {t.url && (
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neo-lavender hover:text-white transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Story Timeline */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 border-b-4 border-white/10 pb-3">
                <h2 className="font-pixel text-xl text-white uppercase flex items-center gap-2">
                  <Clock className="w-5 h-5 text-neo-lime" />
                  STORY EVOLUTION
                </h2>
                <span className="font-pixel text-xs text-white/40 border-2 border-white/20 px-2 py-1">
                  {items.length} ITEMS
                </span>
              </div>

              {items.length === 0 ? (
                <div className="border-4 border-dashed border-white/20 p-10 text-center">
                  <p className="font-pixel text-sm text-white/40 uppercase">NO TIMELINE DATA YET.</p>
                </div>
              ) : (
                <div className="relative">
                  {items.map((item, i) => (
                    <TimelineItem key={item.id} item={item} index={i} />
                  ))}
                </div>
              )}
            </motion.section>
          </>
        )}
      </div>
    </div>
  )
}
