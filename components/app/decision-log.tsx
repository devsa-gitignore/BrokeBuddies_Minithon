'use client'

import useSWR from 'swr'
import { History, BellRing, Moon, CalendarClock } from 'lucide-react'

type DecisionEvent = {
  id: string
  event_type: string
  scheduled_for: string
  status: string
  reason: string | null
  details: { interrupt?: boolean; breakThrough?: boolean; suppressedByBudget?: boolean }
  created_at: string
  title: string | null
  sender: string | null
  source: string | null
  category: string | null
}

type PlanData = {
  upcoming: DecisionEvent[]
  recent: DecisionEvent[]
  budget: { used: number; limit: number }
  state: { mode: string; holdUntil: string | null; nextDigest: string; timezone: string }
}

const fetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('fetch_failed'))))

const EVENT_BADGE: Record<string, { label: string; className: string }> = {
  urgent_notice: { label: 'URGENT', className: 'border-neo-lime bg-neo-lime text-black' },
  people_alert: { label: 'PEOPLE', className: 'border-neo-lavender bg-neo-lavender text-black' },
  digest: { label: 'DIGEST', className: 'border-white/40 bg-white/10 text-white' },
}

function fmtTime(iso: string, tz?: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', ...(tz ? { timeZone: tz } : {}) })
}

function itemLabel(e: DecisionEvent) {
  return e.title || e.sender || e.source || 'Item'
}

function Badge({ type }: { type: string }) {
  const b = EVENT_BADGE[type] ?? { label: type.replace('_', ' ').toUpperCase(), className: 'border-white/40 bg-white/10 text-white' }
  return <span className={`border-2 px-2 py-0.5 font-pixel text-[10px] shadow-[2px_2px_0px_0px_#000] ${b.className}`}>{b.label}</span>
}

function BudgetMeter({ used, limit }: { used: number; limit: number }) {
  const segs = Math.max(1, Math.min(limit, 10))
  const filled = Math.min(segs, Math.round((used / Math.max(limit, 1)) * segs))
  return (
    <div className="flex items-center gap-3">
      <span className="font-pixel text-xs text-white/50 uppercase whitespace-nowrap">BUDGET {used}/{limit}</span>
      <div className="flex gap-1 h-4 border-2 border-white/20 p-0.5">
        {Array.from({ length: segs }).map((_, i) => (
          <div key={i} className={`w-3 h-full ${i < filled ? 'bg-neo-lime' : 'bg-transparent'}`} />
        ))}
      </div>
    </div>
  )
}

function HoldChip({ state }: { state: PlanData['state'] }) {
  if (state.holdUntil) {
    const focus = state.mode === 'focus'
    return (
      <span className={`flex items-center gap-2 border-2 px-3 py-1 font-pixel text-xs uppercase ${focus ? 'border-neo-purple bg-neo-purple text-neo-lime' : 'border-white/20 bg-white/5 text-white/70'}`}>
        <Moon className="w-3.5 h-3.5" />
        {focus ? 'FOCUS' : 'QUIET'} UNTIL {fmtTime(state.holdUntil, state.timezone)}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-2 border-2 border-neo-lime bg-neo-lime text-black px-3 py-1 font-pixel text-xs uppercase shadow-[2px_2px_0px_0px_#000]">
      <BellRing className="w-3.5 h-3.5" />
      OPEN
    </span>
  )
}

function UpcomingRow({ e, tz }: { e: DecisionEvent; tz: string }) {
  return (
    <li className="border-4 border-white/10 bg-transparent p-4 neo-press hover:border-neo-lavender transition-colors">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 text-center border-r-2 border-white/10 pr-4">
          <p className="font-pixel text-lg text-neo-lime tabular-nums">{fmtTime(e.scheduled_for, tz)}</p>
          <p className="font-pixel text-[10px] text-white/40 uppercase mt-0.5">SCHEDULED</p>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge type={e.event_type} />
            {e.details.breakThrough && (
              <span className="border-2 border-neo-lime bg-neo-lime text-black px-2 py-0.5 font-pixel text-[10px] shadow-[2px_2px_0px_0px_#000]">BREAK-THROUGH</span>
            )}
            {e.details.suppressedByBudget && (
              <span className="border-2 border-white/40 bg-white/10 text-white px-2 py-0.5 font-pixel text-[10px]">BUDGET-HELD</span>
            )}
          </div>
          <p className="font-sans font-bold text-white uppercase truncate">{itemLabel(e)}</p>
          {e.reason && <p className="font-sans text-sm text-white/60">{e.reason}</p>}
        </div>
      </div>
    </li>
  )
}

function RecentRow({ e, tz }: { e: DecisionEvent; tz: string }) {
  const cancelled = e.status === 'cancelled'
  return (
    <li className={`flex items-start justify-between gap-4 font-sans text-sm py-2 border-b-2 border-white/5 last:border-b-0 ${cancelled ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className={`border-2 px-1.5 py-0.5 font-pixel text-[10px] ${cancelled ? 'border-white/20 text-white/40' : 'border-neo-lime text-neo-lime'}`}>
          {cancelled ? 'CANCELLED' : 'SCHEDULED'}
        </span>
        <Badge type={e.event_type} />
        <span className={`text-white/80 uppercase font-bold truncate ${cancelled ? 'line-through' : ''}`}>{itemLabel(e)}</span>
      </div>
      <span className="font-pixel text-[10px] text-white/40 uppercase whitespace-nowrap flex-shrink-0">
        {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })}
      </span>
    </li>
  )
}

export function DecisionLog() {
  const { data } = useSWR<PlanData>('/api/delivery-plan', fetcher, { refreshInterval: 30000 })
  if (!data) return null

  const upcoming = data.upcoming ?? []
  const recent = data.recent ?? []

  return (
    <section aria-label="Delivery decision log" className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 border-b-4 border-white/20 pb-2">
        <h2 className="font-pixel text-2xl text-white uppercase flex items-center gap-3">
          <History className="w-6 h-6 text-white" strokeWidth={3} />
          DECISION_LOG
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <HoldChip state={data.state} />
          <span className="flex items-center gap-2 border-2 border-white/20 bg-white/5 px-3 py-1 font-pixel text-xs text-white/70 uppercase">
            <CalendarClock className="w-3.5 h-3.5" />
            DIGEST {fmtTime(data.state.nextDigest, data.state.timezone)}
          </span>
          <BudgetMeter used={data.budget.used} limit={data.budget.limit} />
        </div>
      </div>

      {upcoming.length === 0 ? (
        <div className="border-4 border-dashed border-white/20 p-10 text-center">
          <p className="font-pixel text-sm text-white/40 uppercase">NOTHING QUEUED. THE PLANNER IS HOLDING EVERYTHING.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {upcoming.map((e) => <UpcomingRow key={e.id} e={e} tz={data.state.timezone} />)}
        </ul>
      )}

      {recent.length > 0 && (
        <details className="border-4 border-white/10 p-4 group cursor-pointer">
          <summary className="font-pixel text-sm text-white/60 select-none uppercase group-hover:text-neo-lime transition-colors outline-none">
            RECENT DECISIONS ({recent.length})
          </summary>
          <ul className="mt-4 space-y-1 border-t-2 border-white/10 pt-3">
            {recent.map((e) => <RecentRow key={e.id} e={e} tz={data.state.timezone} />)}
          </ul>
        </details>
      )}
    </section>
  )
}
