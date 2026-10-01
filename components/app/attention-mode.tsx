'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

/* ─── Types ──────────────────────────────────────────────────── */
type AttentionItem = {
  id: string
  source: string
  source_type: string
  sender: string | null
  timestamp: string | null
  category: string
  importance_score: number
  urgency_score: number
  relevance_score: number
  people_kind: string | null
  why: string | null
  act_by: string | null
  urgency_evidence: string | null
  is_overdue: boolean
  metadata: Record<string, unknown>
}

type Mode = 'Focus' | 'Study' | 'Deep Work' | 'Custom'

const MODES: Mode[] = ['Focus', 'Study', 'Deep Work', 'Custom']
const MODE_DURATIONS: Record<Mode, number> = { Focus: 25, Study: 50, 'Deep Work': 90, Custom: 50 }
const MODE_COLORS: Record<Mode, string> = {
  Focus: 'from-orange-500 to-rose-500',
  Study: 'from-violet-500 to-indigo-500',
  'Deep Work': 'from-blue-500 to-cyan-500',
  Custom: 'from-emerald-500 to-teal-500',
}

const fetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('fetch_failed'))))

/* ─── Timer logic ─────────────────────────────────────────────── */
function useTimer(initialSeconds: number) {
  const [remaining, setRemaining] = useState(initialSeconds)
  const [running, setRunning] = useState(false)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(() => setRunning(true), [])
  const pause = useCallback(() => setRunning(false), [])
  const reset = useCallback((secs: number) => { setRunning(false); setRemaining(secs) }, [])

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1000)
    } else {
      if (ref.current) clearInterval(ref.current)
    }
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])

  const pct = initialSeconds > 0 ? Math.max(0, remaining / initialSeconds) : 0
  return { remaining, running, pct, start, pause, reset }
}

function pad(n: number) { return String(n).padStart(2, '0') }
function fmt(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/* ─── Ring SVG ────────────────────────────────────────────────── */
function Ring({ pct, gradient }: { pct: number; gradient: string }) {
  const r = 110
  const circ = 2 * Math.PI * r
  const dash = circ * pct
  return (
    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 260 260">
      <defs>
        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={gradient.includes('violet') ? '#8b5cf6' : gradient.includes('orange') ? '#f97316' : gradient.includes('blue') ? '#3b82f6' : '#10b981'} />
          <stop offset="100%" stopColor={gradient.includes('rose') ? '#f43f5e' : gradient.includes('indigo') ? '#6366f1' : gradient.includes('cyan') ? '#06b6d4' : '#14b8a6'} />
        </linearGradient>
      </defs>
      <circle cx="130" cy="130" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
      <circle
        cx="130" cy="130" r={r} fill="none"
        stroke="url(#ring-grad)" strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  )
}

/* ─── Urgency badge ────────────────────────────────────────────── */
function UrgentCard({ item }: { item: AttentionItem }) {
  const isOverdue = item.is_overdue
  const actBy = item.act_by ? new Date(item.act_by) : null
  const minsAway = actBy ? Math.round((actBy.getTime() - Date.now()) / 60000) : null

  return (
    <article className={`rounded-xl border p-4 space-y-2 ${isOverdue ? 'border-red-500/40 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isOverdue && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400 font-medium">Overdue</span>}
            {!isOverdue && minsAway !== null && minsAway <= 60 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400 font-medium">
                {minsAway <= 0 ? 'Now' : `${minsAway}m away`}
              </span>
            )}
            <span className="text-xs text-white/40">{item.source}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-white">{item.sender ?? item.source}</p>
          {item.urgency_evidence && <p className="text-xs text-white/50 mt-0.5">{item.urgency_evidence}</p>}
        </div>
        {actBy && (
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-white/40">Action by</p>
            <p className="text-sm font-medium text-amber-300">
              {actBy.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
      </div>
      {item.why && <p className="text-xs text-white/40 border-t border-white/5 pt-2">{item.why}</p>}
    </article>
  )
}

/* ─── People card ─────────────────────────────────────────────── */
function PeopleSection({ items }: { items: AttentionItem[] }) {
  const priority = items.filter((i) => i.people_kind && i.people_kind !== 'ordinary')
  const ordinary = items.filter((i) => !i.people_kind || i.people_kind === 'ordinary')
  const uniqueSenders = new Set(ordinary.map((i) => i.sender ?? '?'))

  return (
    <div className="space-y-3">
      {priority.map((item) => (
        <article key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-violet-500/20 flex items-center justify-center text-sm font-medium text-violet-300">
              {(item.sender ?? '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{item.sender ?? 'Unknown'}</p>
              <p className="text-xs text-white/40">{item.source} · {item.people_kind?.replace('_', ' ')}</p>
            </div>
            <span className="text-xs text-white/30">{item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
          </div>
          {item.why && <p className="mt-2 text-xs text-white/40">{item.why}</p>}
        </article>
      ))}

      {ordinary.length > 0 && (
        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm text-white/60 select-none">
            {ordinary.length} message{ordinary.length !== 1 ? 's' : ''} from {uniqueSenders.size} chat{uniqueSenders.size !== 1 ? 's' : ''}
          </summary>
          <ul className="mt-3 space-y-2">
            {ordinary.map((i) => (
              <li key={i.id} className="flex items-center justify-between text-sm">
                <span className="text-white/70">{i.sender ?? 'Unknown'}</span>
                <span className="text-xs text-white/30">{i.source} · {i.timestamp ? new Date(i.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {items.length === 0 && (
        <p className="text-sm text-white/30 text-center py-4">No contact activity right now.</p>
      )}
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────── */
export function AttentionMode() {
  const [mode, setMode] = useState<Mode>('Study')
  const [customDuration, setCustomDuration] = useState(50)
  const [showModeMenu, setShowModeMenu] = useState(false)
  const duration = mode === 'Custom' ? customDuration * 60 : MODE_DURATIONS[mode] * 60
  const { remaining, running, pct, start, pause, reset } = useTimer(duration)

  const { data: urgentData } = useSWR<{ items: AttentionItem[] }>('/api/urgent', fetcher, { refreshInterval: 30000 })
  const { data: peopleData } = useSWR<{ items: AttentionItem[] }>('/api/people', fetcher, { refreshInterval: 30000 })

  const urgentItems = urgentData?.items ?? []
  const peopleItems = peopleData?.items ?? []

  const grad = MODE_COLORS[mode]

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-12">

        {/* ── Timer ────────────────────────────────── */}
        <section className="flex flex-col items-center gap-6">
          {/* Mode selector */}
          <div className="relative">
            <button
              onClick={() => setShowModeMenu(!showModeMenu)}
              className={`rounded-full px-5 py-1.5 text-sm font-medium bg-gradient-to-r ${grad} text-white flex items-center gap-1.5`}
            >
              {mode} <span className="text-white/70 text-xs">▾</span>
            </button>
            {showModeMenu && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-44 rounded-xl border border-white/10 bg-[#1a1a2e] shadow-xl z-10 overflow-hidden">
                {MODES.map((m) => (
                  <button key={m} type="button"
                    onClick={() => { setMode(m); reset(MODE_DURATIONS[m] * 60); setShowModeMenu(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${mode === m ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                  >
                    {m}
                  </button>
                ))}
                {mode === 'Custom' && (
                  <div className="px-4 py-2 border-t border-white/10">
                    <input type="number" min={5} max={240}
                      className="w-full bg-transparent text-sm text-white focus:outline-none"
                      placeholder="Minutes" value={customDuration}
                      onChange={(e) => { const v = Number(e.target.value); setCustomDuration(v); reset(v * 60) }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ring */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            <Ring pct={pct} gradient={grad} />
            <div className="relative text-center">
              <p className="text-5xl font-light tabular-nums tracking-tight text-white">{fmt(remaining)}</p>
              <p className="mt-1 text-xs text-white/30 uppercase tracking-wider">{running ? 'Session running' : remaining === 0 ? 'Complete' : 'Paused'}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={running ? pause : start}
              className={`rounded-full px-8 py-3 text-sm font-semibold transition-all bg-gradient-to-r ${grad} text-white shadow-lg hover:opacity-90`}
            >
              {running ? 'Pause' : remaining === 0 ? 'Restart' : 'Start'}
            </button>
            <button
              onClick={() => reset(duration)}
              className="rounded-full border border-white/10 px-5 py-3 text-sm text-white/40 hover:text-white transition-colors"
            >
              Reset
            </button>
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-white/5" />

        {/* ── Urgent ───────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Urgent</h2>
              <p className="text-xs text-white/40 mt-0.5">Time-sensitive items that need action</p>
            </div>
            {urgentItems.length > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                {urgentItems.length}
              </span>
            )}
          </div>
          {urgentItems.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-6 rounded-xl border border-dashed border-white/10">
              Nothing urgent right now. Focus on your session.
            </p>
          ) : (
            <div className="space-y-3">
              {urgentItems.map((item) => <UrgentCard key={item.id} item={item} />)}
            </div>
          )}
        </section>

        {/* ── People ───────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">People</h2>
              <p className="text-xs text-white/40 mt-0.5">Contact activity that matters</p>
            </div>
            {peopleItems.length > 0 && (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/60">
                {peopleItems.length}
              </span>
            )}
          </div>
          <PeopleSection items={peopleItems} />
        </section>

      </div>
    </div>
  )
}
