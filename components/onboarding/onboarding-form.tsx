'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/* ─── Types ──────────────────────────────────────────────────── */
type PriorityPerson = { name: string; source: 'whatsapp' | 'instagram' | 'phone' | 'gmail' | 'any' }

type State = {
  // Step 0 – name
  name: string
  // Step 1 – purpose
  purpose: string[]
  // Step 2 – sources
  sources: string[]
  // Step 3 – interests
  topics: string[]
  customTopic: string
  // Step 4 – source-specific people
  priorityPeople: PriorityPerson[]
  // Step 5 – job search (conditional)
  jobSearch: boolean
  jobRole: string
  jobLevel: string
  jobRemote: string
  jobLocation: string
  jobUrgentFor: string[]
  // Step 6 – urgent preferences
  urgentCategories: string[]
  breakingNewsTopics: string[]
  // Step 7 – attention preferences
  attentionFilter: 'all' | 'important' | 'urgent_only'
  sessionDuration: number
  quietStart: string
  quietEnd: string
  timezone: string
  // Step 8 – calibration
  calibration: Record<string, boolean>
}

const PURPOSES = [
  { id: 'stay_informed', label: 'Stay informed', icon: '📰' },
  { id: 'focus_study', label: 'Focus & study', icon: '🎯' },
  { id: 'job_hunting', label: 'Job hunting', icon: '💼' },
  { id: 'research', label: 'Research topics', icon: '🔬' },
  { id: 'manage_comms', label: 'Manage communications', icon: '💬' },
  { id: 'organize', label: 'Organize resources', icon: '🗂️' },
]

const ALL_SOURCES = [
  { id: 'WhatsApp', label: 'WhatsApp', icon: '💬', personSource: 'whatsapp' as const },
  { id: 'Instagram', label: 'Instagram', icon: '📷', personSource: 'instagram' as const },
  { id: 'Gmail', label: 'Gmail', icon: '📧', personSource: 'gmail' as const },
  { id: 'Phone', label: 'Phone calls', icon: '📱', personSource: 'phone' as const },
  { id: 'Calendar', label: 'Google Calendar', icon: '📅', personSource: null },
  { id: 'Reddit', label: 'Reddit', icon: '🔴', personSource: null },
  { id: 'News', label: 'News / RSS', icon: '🌐', personSource: null },
  { id: 'Jobs', label: 'Job sites', icon: '🏢', personSource: null },
]

const PRESET_TOPICS = ['AI', 'F1', 'Startups', 'Finance', 'Science', 'Technology', 'Sports', 'Gaming', 'College', 'Politics', 'Design', 'Health']

const URGENT_CATEGORIES = [
  'Meetings today', 'Interviews', 'Deadlines today',
  'Job applications closing today', 'Appointments',
  'Important people contacting me', 'Major developments in selected topics',
]

const SESSION_DURATIONS = [25, 50, 90]

const CALIBRATION_ITEMS = [
  { key: 'boss_deadline', label: 'Your manager: "Need this report by 5pm today"' },
  { key: 'interview_moved', label: 'Your interview was moved to 2pm — you had it set for 4pm' },
  { key: 'friend_repeat', label: 'A friend messages you three times in ten minutes' },
  { key: 'promo_sale', label: 'A store: "Flash sale ends tonight!"' },
  { key: 'breaking_ai', label: 'Multiple sources report a major AI regulation announcement' },
  { key: 'newsletter', label: 'A weekly newsletter digest arrives' },
]

/* ─── Helpers ──────────────────────────────────────────────── */
function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
}

/* ─── Sub-components ─────────────────────────────────────────── */
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-all ${
        active
          ? 'border-violet-500 bg-violet-500/10 text-violet-300'
          : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
      }`}
    >
      {label}
    </button>
  )
}

function PersonRow({
  source, onAdd,
}: {
  source: typeof ALL_SOURCES[0]
  onAdd: (name: string, src: PriorityPerson['source']) => void
}) {
  const [val, setVal] = useState('')
  if (!source.personSource) return null
  const ps = source.personSource
  return (
    <div className="flex gap-2">
      <input
        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
        placeholder={`Add ${source.label} contact or group…`}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && val.trim()) {
            onAdd(val.trim(), ps)
            setVal('')
          }
        }}
      />
      <button
        type="button"
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 hover:text-white"
        onClick={() => { if (val.trim()) { onAdd(val.trim(), ps); setVal('') } }}
      >
        Add
      </button>
    </div>
  )
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all ${
            i < step ? 'w-6 bg-violet-500' : i === step ? 'w-6 bg-violet-400' : 'w-3 bg-white/15'
          }`}
        />
      ))}
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────── */
export function OnboardingForm() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [s, setS] = useState<State>({
    name: '', purpose: [], sources: [], topics: [], customTopic: '',
    priorityPeople: [],
    jobSearch: false, jobRole: '', jobLevel: 'any', jobRemote: 'any', jobLocation: '', jobUrgentFor: [],
    urgentCategories: ['Meetings today', 'Interviews', 'Deadlines today'],
    breakingNewsTopics: [],
    attentionFilter: 'all', sessionDuration: 50,
    quietStart: '22:00', quietEnd: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    calibration: {},
  })

  const up = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }))

  // Compute active sources that support people
  const activePeopleSources = ALL_SOURCES.filter((src) => s.sources.includes(src.id) && src.personSource)

  // Skip job step if Jobs source not selected AND purpose doesn't include job_hunting
  const showJobStep = s.sources.includes('Jobs') || s.purpose.includes('job_hunting')

  // Total steps: 0=name, 1=purpose, 2=sources, 3=interests, 4=people, 5=job(conditional), 6=urgent, 7=attention, 8=calibration, 9=review
  const STEPS = showJobStep ? 10 : 9

  function next() { setStep((x) => Math.min(x + 1, STEPS - 1)) }
  function back() { setStep((x) => Math.max(x - 1, 0)) }

  // Actual step index accounting for conditional job step
  function effectiveStep(raw: number) {
    if (!showJobStep && raw >= 5) return raw + 1
    return raw
  }
  const es = effectiveStep(step)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const priorityPeoplePayload = s.priorityPeople.map((p) => ({
        person_name: p.name, source_type: p.source, priority_weight: 15, enabled: true,
      }))
      const topicsPayload = s.topics.map((t) => ({ topic: t, weight: 1 }))
      const jobPayload = s.jobSearch ? {
        role: s.jobRole || undefined,
        level: s.jobLevel as 'any',
        remote: s.jobRemote as 'any',
        location: s.jobLocation || undefined,
        urgentFor: s.jobUrgentFor.length ? s.jobUrgentFor : undefined,
      } : null

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: s.name || undefined,
          purpose: s.purpose,
          sourcesUsed: s.sources,
          settings: {
            timezone: s.timezone,
            quiet_start: s.quietStart,
            quiet_end: s.quietEnd,
            session_duration_minutes: s.sessionDuration,
            attention_filter: s.attentionFilter,
            urgent_categories: s.urgentCategories,
            breaking_news_topics: s.breakingNewsTopics,
            job_search: jobPayload,
            topics: topicsPayload,
            priorityPeople: priorityPeoplePayload,
          },
          calibration: Object.entries(s.calibration).map(([key, important]) => ({ key, important })),
        }),
      })
      if (!res.ok) throw new Error('save_failed')
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Could not save your setup. Please try again.')
      setBusy(false)
    }
  }

  /* ─── Steps ──────────────────────────────────────────────────── */
  const renderStep = () => {
    switch (es) {
      // 0: Name
      case 0: return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">What should we call you?</h2>
            <p className="mt-1.5 text-sm text-white/50">This is just for display. You can skip it.</p>
          </div>
          <input
            autoFocus
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
            placeholder="Your name (optional)"
            value={s.name}
            onChange={(e) => up({ name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && next()}
          />
        </div>
      )

      // 1: Purpose
      case 1: return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Why are you using this?</h2>
            <p className="mt-1.5 text-sm text-white/50">Select everything that applies. This shapes what the system prioritizes for you.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PURPOSES.map((p) => {
              const active = s.purpose.includes(p.id)
              return (
                <button
                  key={p.id} type="button"
                  onClick={() => up({ purpose: toggle(s.purpose, p.id) })}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                    active ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <span className="text-2xl">{p.icon}</span>
                  <span className="text-sm font-medium text-white">{p.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )

      // 2: Sources
      case 2: return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Where does your information come from?</h2>
            <p className="mt-1.5 text-sm text-white/50">Only select what you actually use. This controls which questions appear next.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ALL_SOURCES.map((src) => {
              const active = s.sources.includes(src.id)
              return (
                <button
                  key={src.id} type="button"
                  onClick={() => up({ sources: toggle(s.sources, src.id) })}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                    active ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <span className="text-xl">{src.icon}</span>
                  <span className="text-sm font-medium text-white">{src.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )

      // 3: Interests
      case 3: return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">What topics do you care about?</h2>
            <p className="mt-1.5 text-sm text-white/50">Used for Highlights and relevance scoring. Pick as many as you like.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_TOPICS.map((t) => (
              <Chip key={t} label={t} active={s.topics.includes(t)} onClick={() => up({ topics: toggle(s.topics, t) })} />
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
              placeholder="Add custom topic…"
              value={s.customTopic}
              onChange={(e) => up({ customTopic: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && s.customTopic.trim()) {
                  up({ topics: [...s.topics, s.customTopic.trim()], customTopic: '' })
                }
              }}
            />
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 hover:text-white"
              onClick={() => { if (s.customTopic.trim()) up({ topics: [...s.topics, s.customTopic.trim()], customTopic: '' }) }}
            >Add</button>
          </div>
          {s.topics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {s.topics.map((t) => (
                <span key={t} className="flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-sm text-violet-300">
                  {t}
                  <button type="button" onClick={() => up({ topics: s.topics.filter((x) => x !== t) })} className="text-violet-400 hover:text-red-400">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )

      // 4: Priority people (conditional per source)
      case 4: return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Who always matters?</h2>
            <p className="mt-1.5 text-sm text-white/50">Messages from these people or groups are treated as high priority per source. Press Enter or click Add.</p>
          </div>
          {activePeopleSources.length === 0 && (
            <p className="text-sm text-white/40">You haven't selected any messaging sources. Skipping this step is fine.</p>
          )}
          <div className="space-y-5">
            {activePeopleSources.map((src) => (
              <div key={src.id} className="space-y-2">
                <p className="text-sm font-medium text-white/70">{src.icon} {src.label}</p>
                <PersonRow
                  source={src}
                  onAdd={(name, sourceType) => up({ priorityPeople: [...s.priorityPeople, { name, source: sourceType }] })}
                />
                <div className="flex flex-wrap gap-1.5">
                  {s.priorityPeople.filter((p) => p.source === src.personSource).map((p) => (
                    <span key={p.name + p.source} className="flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-0.5 text-sm text-violet-300">
                      {p.name}
                      <button type="button" onClick={() => up({ priorityPeople: s.priorityPeople.filter((x) => !(x.name === p.name && x.source === p.source)) })} className="hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )

      // 5: Job search (conditional)
      case 5: return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Tell us about your job search</h2>
            <p className="mt-1.5 text-sm text-white/50">This helps surface relevant job listings and flag application deadlines as Urgent.</p>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Role / Job title', field: 'jobRole' as const, placeholder: 'e.g. Software Engineer, Product Manager' },
              { label: 'Location', field: 'jobLocation' as const, placeholder: 'e.g. Remote, Bangalore, London' },
            ].map(({ label, field, placeholder }) => (
              <label key={field} className="block space-y-1.5">
                <span className="text-sm text-white/60">{label}</span>
                <input
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
                  placeholder={placeholder}
                  value={s[field]}
                  onChange={(e) => up({ [field]: e.target.value })}
                />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-sm text-white/60">Level</span>
                <select className="w-full rounded-lg border border-white/10 bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  value={s.jobLevel} onChange={(e) => up({ jobLevel: e.target.value })}>
                  {['intern', 'entry', 'mid', 'senior', 'lead', 'any'].map((v) => (
                    <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm text-white/60">Work type</span>
                <select className="w-full rounded-lg border border-white/10 bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  value={s.jobRemote} onChange={(e) => up({ jobRemote: e.target.value })}>
                  {['remote', 'hybrid', 'onsite', 'any'].map((v) => (
                    <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm text-white/60">What matters most to you?</legend>
              <div className="flex flex-wrap gap-2">
                {(['openings', 'deadlines', 'interviews', 'company_news', 'salary'] as const).map((v) => (
                  <Chip key={v} label={v.replace('_', ' ')} active={s.jobUrgentFor.includes(v)} onClick={() => up({ jobUrgentFor: toggle(s.jobUrgentFor, v) })} />
                ))}
              </div>
            </fieldset>
          </div>
        </div>
      )

      // 6: Urgent preferences
      case 6: return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">What counts as Urgent for you?</h2>
            <p className="mt-1.5 text-sm text-white/50">The system will only interrupt your focus for these categories.</p>
          </div>
          <fieldset className="space-y-2.5">
            <legend className="text-sm font-medium text-white/70 mb-3">Urgent categories</legend>
            {URGENT_CATEGORIES.map((cat) => {
              const active = s.urgentCategories.includes(cat)
              return (
                <label key={cat} className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => up({ urgentCategories: toggle(s.urgentCategories, cat) })}
                    className={`h-5 w-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                      active ? 'border-violet-500 bg-violet-500' : 'border-white/20 bg-white/5'
                    }`}
                  >
                    {active && <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className="text-sm text-white/80">{cat}</span>
                </label>
              )
            })}
          </fieldset>
          {s.topics.length > 0 && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-white/70">Which topics qualify for breaking-news treatment?</legend>
              <p className="text-xs text-white/40">Only applies when multiple independent sources rapidly report the same story.</p>
              <div className="flex flex-wrap gap-2">
                {s.topics.map((t) => (
                  <Chip key={t} label={t} active={s.breakingNewsTopics.includes(t)} onClick={() => up({ breakingNewsTopics: toggle(s.breakingNewsTopics, t) })} />
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )

      // 7: Attention preferences
      case 7: return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">How should Attention Mode behave?</h2>
            <p className="mt-1.5 text-sm text-white/50">You can change these any time in Settings.</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-white/60">During a session, what information should be shown?</p>
            <div className="space-y-2">
              {([
                { val: 'all', label: 'Everything', desc: 'Show all received information' },
                { val: 'important', label: 'Important only', desc: 'Only relevant to my interests and people' },
                { val: 'urgent_only', label: 'Urgent only', desc: 'Only time-sensitive or high-priority items' },
              ] as const).map(({ val, label, desc }) => (
                <label key={val} className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
                  s.attentionFilter === val ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
                }`} onClick={() => up({ attentionFilter: val })}>
                  <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 ${s.attentionFilter === val ? 'border-violet-400 bg-violet-400' : 'border-white/30'}`} />
                  <div>
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-white/40">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-white/60">Default session length</p>
            <div className="flex gap-3">
              {SESSION_DURATIONS.map((d) => (
                <button key={d} type="button"
                  onClick={() => up({ sessionDuration: d })}
                  className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-all ${
                    s.sessionDuration === d ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-white/10 bg-white/5 text-white/50 hover:text-white'
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Quiet from', field: 'quietStart' as const, type: 'time' },
              { label: 'Quiet until', field: 'quietEnd' as const, type: 'time' },
            ].map(({ label, field, type }) => (
              <label key={field} className="block space-y-1.5">
                <span className="text-sm text-white/60">{label}</span>
                <input type={type} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  value={s[field]} onChange={(e) => up({ [field]: e.target.value })} />
              </label>
            ))}
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm text-white/60">Timezone</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              value={s.timezone} onChange={(e) => up({ timezone: e.target.value })} />
          </label>
        </div>
      )

      // 8: Calibration
      case 8: return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Quick calibration</h2>
            <p className="mt-1.5 text-sm text-white/50">Would you want to be interrupted for these? Your answers initialize personalization.</p>
          </div>
          <div className="space-y-3">
            {CALIBRATION_ITEMS.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <span className="text-sm text-white/80">{c.label}</span>
                <div className="flex gap-2 flex-shrink-0">
                  {(['Yes', 'No'] as const).map((label) => {
                    const val = label === 'Yes'
                    const active = s.calibration[c.key] === val
                    return (
                      <button key={label} type="button"
                        onClick={() => up({ calibration: { ...s.calibration, [c.key]: val } })}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                          active ? (val ? 'bg-violet-500 text-white' : 'bg-red-500/30 text-red-300') : 'border border-white/10 text-white/40 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )

      // 9: Review
      case 9: return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Here's your setup</h2>
            <p className="mt-1.5 text-sm text-white/50">Everything can be changed in Settings at any time.</p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Name', value: s.name || '—' },
              { label: 'Interests', value: s.topics.length ? s.topics.join(' · ') : 'None selected' },
              { label: 'Sources', value: s.sources.length ? s.sources.join(', ') : 'None' },
              {
                label: 'Priority contacts',
                value: s.priorityPeople.length
                  ? s.priorityPeople.map((p) => `${p.name} (${p.source})`).join(', ')
                  : 'None',
              },
              { label: 'Urgent categories', value: s.urgentCategories.length ? s.urgentCategories.join(', ') : 'None' },
              { label: 'Session length', value: `${s.sessionDuration} minutes` },
              { label: 'Attention filter', value: s.attentionFilter.replace('_', ' ') },
              { label: 'Timezone', value: s.timezone },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-sm text-white/50">{label}</span>
                <span className="text-sm text-white text-right max-w-[60%]">{value}</span>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )

      default: return null
    }
  }

  const isLastStep = step === STEPS - 1

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <span className="text-sm font-medium text-violet-400 tracking-wider uppercase">Setup</span>
          <StepIndicator step={step} total={STEPS} />
        </div>

        {/* Step content */}
        <div className="min-h-[400px]">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-4">
          {step > 0 ? (
            <button type="button" onClick={back}
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white/60 hover:text-white transition-colors">
              Back
            </button>
          ) : <div />}

          {isLastStep ? (
            <button type="button" onClick={submit} disabled={busy}
              className="rounded-xl bg-violet-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50 transition-colors">
              {busy ? 'Saving…' : 'Finish setup →'}
            </button>
          ) : (
            <button type="button" onClick={next}
              className="rounded-xl bg-violet-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 transition-colors">
              Continue →
            </button>
          )}
        </div>

        {/* Skip */}
        {step < STEPS - 1 && (
          <p className="mt-4 text-center text-xs text-white/30">
            <button type="button" onClick={() => setStep(STEPS - 1)} className="hover:text-white/60 transition-colors">
              Skip to review
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
