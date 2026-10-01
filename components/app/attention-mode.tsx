'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, AlertTriangle, Users, Play, Pause, RotateCcw, ChevronDown } from 'lucide-react'

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
  Focus: 'bg-neo-lime text-black border-black shadow-neo-lavender',
  Study: 'bg-neo-lavender text-black border-black shadow-neo-purple',
  'Deep Work': 'bg-neo-purple text-neo-lime border-white shadow-neo-lime',
  Custom: 'bg-neo-green text-neo-lime border-white shadow-neo-lavender',
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

/* ─── Blocky Progress Bar ─────────────────────────────────────── */
function BlockyProgressBar({ pct, colorClass, running }: { pct: number; colorClass: string; running: boolean }) {
  const blocks = 20
  const activeBlocks = Math.ceil(pct * blocks)
  
  return (
    <div className="flex flex-col gap-1 w-full max-w-xs mt-8">
      <div className="flex gap-1 h-8 w-full border-4 border-white/20 p-1">
        {Array.from({ length: blocks }).map((_, i) => (
          <div 
            key={i} 
            className={`flex-1 transition-all duration-300 ${i < activeBlocks ? (running ? 'bg-neo-lime' : 'bg-neo-lavender') : 'bg-transparent'}`}
          />
        ))}
      </div>
      <div className="flex justify-between font-pixel text-xs text-white/50 px-1 uppercase">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

/* ─── Urgency badge ────────────────────────────────────────────── */
function UrgentCard({ item }: { item: AttentionItem }) {
  const isOverdue = item.is_overdue
  const actBy = item.act_by ? new Date(item.act_by) : null
  const minsAway = actBy ? Math.round((actBy.getTime() - Date.now()) / 60000) : null

  return (
    <motion.article 
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`border-4 p-5 space-y-3 neo-press ${isOverdue ? 'border-neo-lime bg-neo-green shadow-neo-lime' : 'border-neo-lavender bg-neo-purple shadow-neo-lavender'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {isOverdue && <span className="border-2 border-[#ef4444] bg-[#ef4444] text-white px-2 py-0.5 font-pixel text-xs shadow-[2px_2px_0px_0px_#000]">OVERDUE</span>}
            {!isOverdue && minsAway !== null && minsAway <= 60 && (
              <span className="border-2 border-neo-lime bg-neo-lime text-black px-2 py-0.5 font-pixel text-xs shadow-[2px_2px_0px_0px_#000]">
                {minsAway <= 0 ? 'NOW' : `${minsAway}M AWAY`}
              </span>
            )}
            <span className="font-pixel text-xs text-white/60 uppercase">{item.source}</span>
          </div>
          <p className="mt-2 text-lg font-sans text-white uppercase font-bold tracking-wide leading-tight">{item.sender ?? item.source}</p>
          {item.urgency_evidence && <p className="font-sans text-sm text-white/70 mt-1">{item.urgency_evidence}</p>}
        </div>
        {actBy && (
          <div className="text-right flex-shrink-0 border-l-2 border-white/20 pl-4">
            <p className="font-pixel text-xs text-white/60 uppercase">ACTION BY</p>
            <p className="font-pixel text-xl text-neo-lime mt-1">
              {actBy.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
      </div>
      {item.why && <p className="font-sans text-sm text-neo-lavender border-t-2 border-white/10 pt-3">{item.why}</p>}
    </motion.article>
  )
}

/* ─── People card ─────────────────────────────────────────────── */
function PeopleSection({ items }: { items: AttentionItem[] }) {
  const priority = items.filter((i) => i.people_kind && i.people_kind !== 'ordinary')
  const ordinary = items.filter((i) => !i.people_kind || i.people_kind === 'ordinary')
  const uniqueSenders = new Set(ordinary.map((i) => i.sender ?? '?'))

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {priority.map((item) => (
          <motion.article 
            key={item.id}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="border-4 border-white/20 bg-transparent p-5 neo-press hover:border-neo-lavender hover:bg-neo-purple/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 border-2 border-neo-lavender bg-neo-lavender text-black flex items-center justify-center font-pixel text-xl shadow-[2px_2px_0px_0px_#fff]">
                {(item.sender ?? '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-lg font-bold text-white uppercase truncate">{item.sender ?? 'UNKNOWN'}</p>
                <p className="font-pixel text-xs text-neo-lavender uppercase mt-1">{item.source} // {item.people_kind?.replace('_', ' ')}</p>
              </div>
              <span className="font-pixel text-xs text-white/50 border-2 border-white/10 px-2 py-1">
                {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
            {item.why && <p className="mt-4 font-sans text-sm text-white/70 border-t-2 border-white/10 pt-3">{item.why}</p>}
          </motion.article>
        ))}
      </AnimatePresence>

      {ordinary.length > 0 && (
        <details className="border-4 border-white/10 bg-transparent p-4 group cursor-pointer">
          <summary className="font-pixel text-sm text-white/60 select-none uppercase group-hover:text-neo-lime transition-colors outline-none">
            {ordinary.length} MESSAGE{ordinary.length !== 1 ? 'S' : ''} FROM {uniqueSenders.size} CHAT{uniqueSenders.size !== 1 ? 'S' : ''}
          </summary>
          <ul className="mt-4 space-y-3 border-t-2 border-white/10 pt-4">
            {ordinary.map((i) => (
              <li key={i.id} className="flex items-center justify-between font-sans text-sm">
                <span className="text-white/80 uppercase font-bold">{i.sender ?? 'UNKNOWN'}</span>
                <span className="font-pixel text-xs text-white/40 uppercase">{i.source} // {i.timestamp ? new Date(i.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {items.length === 0 && (
        <div className="border-4 border-dashed border-white/20 p-8 text-center">
          <p className="font-pixel text-sm text-white/40 uppercase">NO COMMS DETECTED.</p>
        </div>
      )}
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────── */
export function AttentionMode() {
  const [mode, setMode] = useState<Mode>('Focus')
  const [customDuration, setCustomDuration] = useState(50)
  const [showModeMenu, setShowModeMenu] = useState(false)
  const duration = mode === 'Custom' ? customDuration * 60 : MODE_DURATIONS[mode] * 60
  const { remaining, running, pct, start, pause, reset } = useTimer(duration)

  const { data: urgentData } = useSWR<{ items: AttentionItem[] }>('/api/urgent', fetcher, { refreshInterval: 30000 })
  const { data: peopleData } = useSWR<{ items: AttentionItem[] }>('/api/people', fetcher, { refreshInterval: 30000 })

  const urgentItems = urgentData?.items ?? []
  const peopleItems = peopleData?.items ?? []

  const modeStyle = MODE_COLORS[mode]

  return (
    <div className="min-h-[calc(100vh-64px)] bg-neo-black text-white p-6 md:p-12 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12">

        {/* ── Timer Section (Left) ────────────────────────────────── */}
        <section className="lg:col-span-5 flex flex-col items-center lg:items-start gap-8">
          
          <div className="w-full flex items-center justify-between border-b-4 border-white/10 pb-6">
            <h1 className="font-pixel text-3xl text-white uppercase flex items-center gap-3">
              <Clock className="w-8 h-8 text-neo-lime" strokeWidth={3} />
              TIMER_SYS
            </h1>
            
            {/* Mode selector */}
            <div className="relative">
              <button
                onClick={() => setShowModeMenu(!showModeMenu)}
                className={`border-4 px-4 py-2 font-pixel text-sm uppercase flex items-center gap-2 neo-press transition-colors ${modeStyle}`}
              >
                {mode} <ChevronDown className="w-4 h-4" />
              </button>
              {showModeMenu && (
                <div className="absolute top-full mt-2 right-0 w-48 border-4 border-white bg-neo-black shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] z-20">
                  {MODES.map((m) => (
                    <button key={m} type="button"
                      onClick={() => { setMode(m); reset(MODE_DURATIONS[m] * 60); setShowModeMenu(false) }}
                      className={`w-full text-left px-4 py-3 font-pixel text-sm uppercase transition-colors hover:bg-white hover:text-black ${mode === m ? 'bg-white/10 text-neo-lime' : 'text-white'}`}
                    >
                      {m}
                    </button>
                  ))}
                  {mode === 'Custom' && (
                    <div className="px-4 py-3 border-t-4 border-white bg-neo-purple">
                      <input type="number" min={5} max={240}
                         className="w-full bg-transparent text-sm font-pixel text-neo-lime focus:outline-none placeholder:text-neo-lime/50 uppercase"
                        placeholder="MINUTES" value={customDuration}
                        onChange={(e) => { const v = Number(e.target.value); setCustomDuration(v); reset(v * 60) }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="w-full flex flex-col items-center py-12 border-4 border-white/10 bg-white/5 relative overflow-hidden">
            <div className="absolute -right-16 -top-16 font-pixel text-9xl text-white/5 opacity-50 select-none pointer-events-none">
              {running ? 'ON' : 'OFF'}
            </div>
            
            <p className="text-7xl md:text-9xl font-pixel tabular-nums tracking-tighter text-white drop-shadow-[4px_4px_0px_rgba(205,252,138,0.3)]">
              {fmt(remaining)}
            </p>
            <p className="mt-4 font-pixel text-sm text-neo-lavender uppercase tracking-widest bg-neo-purple px-4 py-1 border-2 border-neo-lavender">
              {running ? 'SESSION ACTIVE' : remaining === 0 ? 'COMPLETE' : 'STANDBY'}
            </p>

            <BlockyProgressBar pct={pct} colorClass={modeStyle} running={running} />
          </div>

          <div className="w-full flex items-center justify-center gap-6">
            <button
              onClick={running ? pause : start}
              className={`flex items-center gap-3 border-4 px-8 py-4 font-pixel text-2xl uppercase neo-press transition-colors ${running ? 'bg-neo-lavender text-black border-black shadow-neo-purple' : 'bg-neo-lime text-black border-black shadow-neo-lavender'}`}
            >
              {running ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              {running ? 'PAUSE' : remaining === 0 ? 'RESTART' : 'START'}
            </button>
            <button
              onClick={() => reset(duration)}
              className="flex items-center justify-center w-16 h-16 border-4 border-white/20 text-white/50 hover:border-white hover:text-white bg-transparent neo-press transition-colors"
              title="Reset"
            >
              <RotateCcw className="w-6 h-6" />
            </button>
          </div>
        </section>

        {/* ── Feed Section (Right) ───────────────────────────────── */}
        <section className="lg:col-span-7 flex flex-col gap-12">
          
          {/* Urgent */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b-4 border-neo-lime pb-2">
              <h2 className="font-pixel text-2xl text-neo-lime uppercase flex items-center gap-3">
                <AlertTriangle className="w-6 h-6" strokeWidth={3} />
                URGENT_QUEUE
              </h2>
              {urgentItems.length > 0 && (
                <span className="border-2 border-neo-lime bg-neo-lime text-black font-pixel px-3 py-1 text-sm shadow-[2px_2px_0px_0px_#000]">
                  {urgentItems.length}
                </span>
              )}
            </div>
            
            {urgentItems.length === 0 ? (
              <div className="border-4 border-dashed border-white/20 p-10 text-center flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-neo-lime rounded-full" />
                </div>
                <p className="font-pixel text-sm text-white/40 uppercase">NO URGENT ITEMS. FOCUS MAINTAINED.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {urgentItems.map((item) => <UrgentCard key={item.id} item={item} />)}
              </div>
            )}
          </div>

          {/* People */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b-4 border-neo-lavender pb-2">
              <h2 className="font-pixel text-2xl text-neo-lavender uppercase flex items-center gap-3">
                <Users className="w-6 h-6" strokeWidth={3} />
                CONTACT_INTEL
              </h2>
              {peopleItems.length > 0 && (
                <span className="border-2 border-neo-lavender bg-neo-lavender text-black font-pixel px-3 py-1 text-sm shadow-[2px_2px_0px_0px_#000]">
                  {peopleItems.length}
                </span>
              )}
            </div>
            <PeopleSection items={peopleItems} />
          </div>

        </section>
      </div>
    </div>
  )
}
