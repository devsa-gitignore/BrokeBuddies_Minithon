'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Newspaper, Target, Briefcase, FlaskConical, MessageSquare, Folders,
  MessageCircle, Camera, Mail, Phone, Calendar, Rss, Building2, Zap
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────────── */
type PriorityPerson = { name: string; source: 'whatsapp' | 'instagram' | 'phone' | 'gmail' | 'any' }

type State = {
  name: string
  purpose: string[]
  sources: string[]
  topics: string[]
  customTopic: string
  priorityPeople: PriorityPerson[]
  jobSearch: boolean
  jobRole: string
  jobLevel: string
  jobRemote: string
  jobLocation: string
  jobUrgentFor: string[]
  urgentCategories: string[]
  breakingNewsTopics: string[]
  attentionFilter: 'all' | 'important' | 'urgent_only'
  sessionDuration: number
  quietStart: string
  quietEnd: string
  timezone: string
  calibration: Record<string, boolean>
}

const PURPOSES = [
  { id: 'stay_informed', label: 'Stay informed', icon: Newspaper },
  { id: 'focus_study', label: 'Focus & study', icon: Target },
  { id: 'job_hunting', label: 'Job hunting', icon: Briefcase },
  { id: 'research', label: 'Research topics', icon: FlaskConical },
  { id: 'manage_comms', label: 'Manage comms', icon: MessageSquare },
  { id: 'organize', label: 'Organize resources', icon: Folders },
]

const ALL_SOURCES = [
  { id: 'WhatsApp', label: 'WhatsApp', icon: MessageCircle, personSource: 'whatsapp' as const },
  { id: 'Instagram', label: 'Instagram', icon: Camera, personSource: 'instagram' as const },
  { id: 'Gmail', label: 'Gmail', icon: Mail, personSource: 'gmail' as const },
  { id: 'Phone', label: 'Phone calls', icon: Phone, personSource: 'phone' as const },
  { id: 'Calendar', label: 'Calendar', icon: Calendar, personSource: null },
  { id: 'Reddit', label: 'Reddit', icon: MessageSquare, personSource: null },
  { id: 'News', label: 'News / RSS', icon: Rss, personSource: null },
  { id: 'Jobs', label: 'Job sites', icon: Building2, personSource: null },
]

const PRESET_TOPICS = ['AI', 'F1', 'Startups', 'Finance', 'Science', 'Technology', 'Sports', 'Gaming', 'College', 'Politics', 'Design', 'Health']

const URGENT_CATEGORIES = [
  'Meetings today', 'Interviews', 'Deadlines today',
  'Job applications closing today', 'Appointments',
  'Important people contacting me', 'Major developments in selected topics',
]

const SESSION_DURATIONS = [25, 50, 90]

const CALIBRATION_ITEMS = [
  { key: 'boss_deadline', label: 'Manager: "Need this report by 5pm"' },
  { key: 'interview_moved', label: 'Interview moved to 2pm from 4pm' },
  { key: 'friend_repeat', label: 'Friend messages 3 times in 10 mins' },
  { key: 'promo_sale', label: 'Store: "Flash sale ends tonight!"' },
  { key: 'breaking_ai', label: 'Major AI regulation announcement' },
  { key: 'newsletter', label: 'Weekly newsletter digest arrives' },
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
      className={`font-pixel text-lg px-4 py-2 border-2 transition-colors neo-press shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] ${
        active
          ? 'border-neo-lime bg-neo-purple text-neo-lime shadow-[2px_2px_0px_0px_var(--color-neo-lime)]'
          : 'border-white/20 text-white/70 hover:border-white/50'
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
  const Icon = source.icon
  return (
    <div className="flex gap-2 w-full md:w-2/3">
      <div className="flex items-center justify-center bg-white/10 px-3 border-2 border-white/20">
        <Icon className="w-5 h-5 text-white/50" />
      </div>
      <input
        className="flex-1 border-2 border-white/20 bg-transparent px-4 py-2 text-white font-sans focus:outline-none focus:border-neo-lime placeholder:text-white/30"
        placeholder={`Add ${source.label} contact…`}
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
        className="font-pixel border-2 border-neo-lavender bg-neo-purple text-neo-lavender px-4 py-2 neo-press shadow-[2px_2px_0px_0px_var(--color-neo-lavender)]"
        onClick={() => { if (val.trim()) { onAdd(val.trim(), ps); setVal('') } }}
      >
        ADD
      </button>
    </div>
  )
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 transition-all ${
            i < step ? 'w-8 bg-neo-lime shadow-[1px_1px_0px_0px_#fff]' : i === step ? 'w-8 bg-neo-lavender shadow-[1px_1px_0px_0px_#fff]' : 'w-4 bg-white/20'
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

  const activePeopleSources = ALL_SOURCES.filter((src) => s.sources.includes(src.id) && src.personSource)
  const showJobStep = s.sources.includes('Jobs') || s.purpose.includes('job_hunting')
  const STEPS = showJobStep ? 10 : 9

  function next() { setStep((x) => Math.min(x + 1, STEPS - 1)) }
  function back() { setStep((x) => Math.max(x - 1, 0)) }

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
      const jobPayload = s.jobSearch || showJobStep ? {
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
      setError('System Error. Save Failed.')
      setBusy(false)
    }
  }

  /* ─── Steps ──────────────────────────────────────────────────── */
  const renderStep = () => {
    switch (es) {
      case 0: return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div>
            <h2 className="font-pixel text-4xl text-neo-lime uppercase">IDENTIFICATION</h2>
            <p className="mt-2 text-lg text-white/50">What is your designation?</p>
          </div>
          <input
            autoFocus
            className="w-full md:w-2/3 border-4 border-white/20 bg-transparent px-6 py-4 text-2xl text-white font-pixel uppercase focus:outline-none focus:border-neo-lime placeholder:text-white/20 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] focus:shadow-neo-lime transition-all"
            placeholder="YOUR NAME (OPTIONAL)"
            value={s.name}
            onChange={(e) => up({ name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && next()}
          />
        </motion.div>
      )

      case 1: return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div>
            <h2 className="font-pixel text-4xl text-neo-lavender uppercase">PRIMARY OBJECTIVES</h2>
            <p className="mt-2 text-lg text-white/50">Select all that apply. Shapes system prioritization.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PURPOSES.map((p) => {
              const active = s.purpose.includes(p.id)
              const Icon = p.icon
              return (
                <button
                  key={p.id} type="button"
                  onClick={() => up({ purpose: toggle(s.purpose, p.id) })}
                  className={`flex flex-col items-start gap-4 border-4 p-6 text-left transition-all neo-press ${
                    active 
                      ? 'border-neo-lavender bg-neo-purple shadow-[4px_4px_0px_0px_var(--color-neo-lavender)]' 
                      : 'border-white/10 bg-transparent shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] hover:border-white/30'
                  }`}
                >
                  <Icon className={`w-8 h-8 ${active ? 'text-neo-lavender' : 'text-white/40'}`} strokeWidth={2} />
                  <span className={`font-pixel text-xl uppercase ${active ? 'text-white' : 'text-white/60'}`}>{p.label}</span>
                </button>
              )
            })}
          </div>
        </motion.div>
      )

      case 2: return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div>
            <h2 className="font-pixel text-4xl text-neo-lime uppercase">DATA SOURCES</h2>
            <p className="mt-2 text-lg text-white/50">Connect your information streams.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ALL_SOURCES.map((src) => {
              const active = s.sources.includes(src.id)
              const Icon = src.icon
              return (
                <button
                  key={src.id} type="button"
                  onClick={() => up({ sources: toggle(s.sources, src.id) })}
                  className={`flex items-center gap-3 border-4 p-4 text-left transition-all neo-press ${
                    active 
                      ? 'border-neo-lime bg-neo-green shadow-[4px_4px_0px_0px_var(--color-neo-lime)]' 
                      : 'border-white/10 bg-transparent shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] hover:border-white/30'
                  }`}
                >
                  <Icon className={`w-6 h-6 flex-shrink-0 ${active ? 'text-neo-lime' : 'text-white/40'}`} strokeWidth={2} />
                  <span className={`font-pixel text-lg uppercase ${active ? 'text-white' : 'text-white/60'}`}>{src.label}</span>
                </button>
              )
            })}
          </div>
        </motion.div>
      )

      case 3: return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div>
            <h2 className="font-pixel text-4xl text-neo-lavender uppercase">INTEREST VECTORS</h2>
            <p className="mt-2 text-lg text-white/50">Defines highlight generation and relevance scoring.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {PRESET_TOPICS.map((t) => (
              <Chip key={t} label={t} active={s.topics.includes(t)} onClick={() => up({ topics: toggle(s.topics, t) })} />
            ))}
          </div>
          <div className="flex gap-3 w-full md:w-2/3">
            <input
              className="flex-1 border-4 border-white/20 bg-transparent px-4 py-3 font-pixel text-lg text-white placeholder:text-white/30 focus:outline-none focus:border-neo-lavender"
              placeholder="ADD CUSTOM TOPIC..."
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
              className="font-pixel text-xl bg-neo-lavender text-black border-4 border-black px-6 py-3 neo-press shadow-neo-purple"
              onClick={() => { if (s.customTopic.trim()) up({ topics: [...s.topics, s.customTopic.trim()], customTopic: '' }) }}
            >
              ADD
            </button>
          </div>
          {s.topics.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4">
              {s.topics.map((t) => (
                <span key={t} className="flex items-center gap-2 border-2 border-neo-lavender bg-neo-purple px-4 py-1.5 font-pixel text-neo-lavender">
                  {t}
                  <button type="button" onClick={() => up({ topics: s.topics.filter((x) => x !== t) })} className="text-neo-lavender hover:text-red-400">×</button>
                </span>
              ))}
            </div>
          )}
        </motion.div>
      )

      case 4: return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div>
            <h2 className="font-pixel text-4xl text-neo-lime uppercase">PRIORITY PROTOCOL</h2>
            <p className="mt-2 text-lg text-white/50">Designate VIP contacts per source.</p>
          </div>
          {activePeopleSources.length === 0 && (
            <div className="border-4 border-dashed border-white/20 p-8 text-center text-white/40 font-pixel text-xl uppercase">
              No communication sources selected.
            </div>
          )}
          <div className="space-y-8">
            {activePeopleSources.map((src) => {
              const Icon = src.icon
              return (
                <div key={src.id} className="space-y-4 bg-white/5 p-6 border-2 border-white/10">
                  <div className="flex items-center gap-2 text-neo-lime font-pixel text-xl uppercase">
                    <Icon className="w-6 h-6" /> {src.label}
                  </div>
                  <PersonRow
                    source={src}
                    onAdd={(name, sourceType) => up({ priorityPeople: [...s.priorityPeople, { name, source: sourceType }] })}
                  />
                  <div className="flex flex-wrap gap-2 pt-2">
                    {s.priorityPeople.filter((p) => p.source === src.personSource).map((p) => (
                      <span key={p.name + p.source} className="flex items-center gap-2 border-2 border-neo-lime bg-neo-green px-3 py-1 font-pixel text-neo-lime">
                        {p.name}
                        <button type="button" onClick={() => up({ priorityPeople: s.priorityPeople.filter((x) => !(x.name === p.name && x.source === p.source)) })} className="hover:text-red-400">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )

      case 5: return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div>
            <h2 className="font-pixel text-4xl text-neo-lavender uppercase">CAREER OBJECTIVES</h2>
            <p className="mt-2 text-lg text-white/50">Configures job listing filters and deadline alerts.</p>
          </div>
          <div className="space-y-6 max-w-2xl">
            {[
              { label: 'Role / Job title', field: 'jobRole' as const, placeholder: 'E.G. SOFTWARE ENGINEER' },
              { label: 'Location', field: 'jobLocation' as const, placeholder: 'E.G. REMOTE, LONDON' },
            ].map(({ label, field, placeholder }) => (
              <label key={field} className="block space-y-2">
                <span className="font-pixel text-lg text-white/60 uppercase">{label}</span>
                <input
                  className="w-full border-4 border-white/20 bg-transparent px-4 py-3 text-white font-sans focus:outline-none focus:border-neo-lavender placeholder:text-white/30"
                  placeholder={placeholder}
                  value={s[field]}
                  onChange={(e) => up({ [field]: e.target.value })}
                />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-6">
              <label className="block space-y-2">
                <span className="font-pixel text-lg text-white/60 uppercase">Level</span>
                <select className="w-full border-4 border-white/20 bg-neo-black px-4 py-3 text-white font-sans focus:outline-none focus:border-neo-lavender"
                  value={s.jobLevel} onChange={(e) => up({ jobLevel: e.target.value })}>
                  {['intern', 'entry', 'mid', 'senior', 'lead', 'any'].map((v) => (
                    <option key={v} value={v}>{v.toUpperCase()}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="font-pixel text-lg text-white/60 uppercase">Work type</span>
                <select className="w-full border-4 border-white/20 bg-neo-black px-4 py-3 text-white font-sans focus:outline-none focus:border-neo-lavender"
                  value={s.jobRemote} onChange={(e) => up({ jobRemote: e.target.value })}>
                  {['remote', 'hybrid', 'onsite', 'any'].map((v) => (
                    <option key={v} value={v}>{v.toUpperCase()}</option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="space-y-3 pt-4 border-t-2 border-white/10">
              <legend className="font-pixel text-lg text-white/60 uppercase">Urgency Triggers</legend>
              <div className="flex flex-wrap gap-3">
                {(['openings', 'deadlines', 'interviews', 'company_news', 'salary'] as const).map((v) => (
                  <Chip key={v} label={v.replace('_', ' ').toUpperCase()} active={s.jobUrgentFor.includes(v)} onClick={() => up({ jobUrgentFor: toggle(s.jobUrgentFor, v) })} />
                ))}
              </div>
            </fieldset>
          </div>
        </motion.div>
      )

      case 6: return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div>
            <h2 className="font-pixel text-4xl text-neo-lime uppercase">URGENCY DEFINITIONS</h2>
            <p className="mt-2 text-lg text-white/50">System interrupt protocols.</p>
          </div>
          <fieldset className="space-y-4">
            <legend className="font-pixel text-xl text-white/70 mb-4 uppercase">Standard Urgencies</legend>
            <div className="grid md:grid-cols-2 gap-4">
              {URGENT_CATEGORIES.map((cat) => {
                const active = s.urgentCategories.includes(cat)
                return (
                  <label key={cat} className={`flex items-center gap-4 cursor-pointer border-2 p-4 transition-colors ${active ? 'border-neo-lime bg-neo-green' : 'border-white/10 bg-transparent hover:border-white/30'}`}>
                    <div className={`w-6 h-6 border-2 flex items-center justify-center ${active ? 'border-neo-lime bg-neo-lime' : 'border-white/30'}`}>
                      {active && <Zap className="w-4 h-4 text-black" />}
                    </div>
                    <span className="font-sans text-white/90">{cat}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          {s.topics.length > 0 && (
            <fieldset className="space-y-4 pt-6 border-t-2 border-white/10">
              <legend className="font-pixel text-xl text-white/70 uppercase">Breaking News Topics</legend>
              <p className="text-sm text-white/40">Only triggers if rapidly reported by independent sources.</p>
              <div className="flex flex-wrap gap-3">
                {s.topics.map((t) => (
                  <Chip key={t} label={t} active={s.breakingNewsTopics.includes(t)} onClick={() => up({ breakingNewsTopics: toggle(s.breakingNewsTopics, t) })} />
                ))}
              </div>
            </fieldset>
          )}
        </motion.div>
      )

      case 7: return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div>
            <h2 className="font-pixel text-4xl text-neo-lavender uppercase">ATTENTION PARAMS</h2>
            <p className="mt-2 text-lg text-white/50">Focus mode configurations.</p>
          </div>
          <div className="space-y-8 max-w-2xl">
            <div className="space-y-4">
              <p className="font-pixel text-lg text-white/60 uppercase">Visibility Filter</p>
              <div className="grid gap-3">
                {([
                  { val: 'all', label: 'Everything', desc: 'Show all received information' },
                  { val: 'important', label: 'Important only', desc: 'Relevant to my interests and people' },
                  { val: 'urgent_only', label: 'Urgent only', desc: 'Time-sensitive or high-priority items' },
                ] as const).map(({ val, label, desc }) => (
                  <label key={val} className={`flex items-start gap-4 border-4 p-5 cursor-pointer transition-colors ${
                    s.attentionFilter === val ? 'border-neo-lavender bg-neo-purple' : 'border-white/10 bg-transparent hover:border-white/30'
                  }`} onClick={() => up({ attentionFilter: val })}>
                    <div className={`mt-1 w-5 h-5 border-2 flex-shrink-0 ${s.attentionFilter === val ? 'border-neo-lavender bg-neo-lavender' : 'border-white/30'}`} />
                    <div>
                      <p className="font-pixel text-xl text-white uppercase">{label}</p>
                      <p className="font-sans text-sm text-white/50 mt-1">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-4 border-t-2 border-white/10 pt-6">
              <p className="font-pixel text-lg text-white/60 uppercase">Default Session (MINUTES)</p>
              <div className="flex gap-4">
                {SESSION_DURATIONS.map((d) => (
                  <button key={d} type="button"
                    onClick={() => up({ sessionDuration: d })}
                    className={`flex-1 border-4 py-4 font-pixel text-2xl transition-colors neo-press ${
                      s.sessionDuration === d ? 'border-neo-lavender bg-neo-purple text-neo-lavender shadow-[4px_4px_0px_0px_var(--color-neo-lavender)]' : 'border-white/20 text-white/50 hover:border-white/50'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 border-t-2 border-white/10 pt-6">
              {[
                { label: 'Quiet Start', field: 'quietStart' as const },
                { label: 'Quiet End', field: 'quietEnd' as const },
              ].map(({ label, field }) => (
                <label key={field} className="block space-y-2">
                  <span className="font-pixel text-lg text-white/60 uppercase">{label}</span>
                  <input type="time" className="w-full border-4 border-white/20 bg-transparent px-4 py-3 text-white font-sans focus:outline-none focus:border-neo-lavender"
                    value={s[field]} onChange={(e) => up({ [field]: e.target.value })} />
                </label>
              ))}
            </div>
          </div>
        </motion.div>
      )

      case 8: return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div>
            <h2 className="font-pixel text-4xl text-neo-lime uppercase">CALIBRATION</h2>
            <p className="mt-2 text-lg text-white/50">Should these break your focus?</p>
          </div>
          <div className="grid gap-4 max-w-3xl">
            {CALIBRATION_ITEMS.map((c) => (
              <div key={c.key} className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-4 border-white/10 bg-white/5 p-5">
                <span className="font-sans text-white/90">{c.label}</span>
                <div className="flex gap-3 flex-shrink-0">
                  {(['Yes', 'No'] as const).map((label) => {
                    const val = label === 'Yes'
                    const active = s.calibration[c.key] === val
                    return (
                      <button key={label} type="button"
                        onClick={() => up({ calibration: { ...s.calibration, [c.key]: val } })}
                        className={`font-pixel text-xl border-2 px-6 py-2 transition-colors neo-press ${
                          active 
                            ? (val ? 'border-neo-lime bg-neo-green text-neo-lime shadow-[2px_2px_0px_0px_var(--color-neo-lime)]' : 'border-[#ef4444] bg-[#ef4444]/20 text-[#ef4444] shadow-[2px_2px_0px_0px_#ef4444]') 
                            : 'border-white/20 text-white/40 hover:border-white/50 hover:text-white'
                        }`}
                      >
                        {label.toUpperCase()}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )

      case 9: return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div>
            <h2 className="font-pixel text-4xl text-neo-lavender uppercase">SYSTEM READY</h2>
            <p className="mt-2 text-lg text-white/50">Verify configurations.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {[
              { label: 'Identifier', value: s.name || 'ANONYMOUS' },
              { label: 'Interests', value: s.topics.length ? s.topics.join(' // ') : 'NONE' },
              { label: 'Sources', value: s.sources.length ? s.sources.join(' // ') : 'NONE' },
              {
                label: 'Priority Contacts',
                value: s.priorityPeople.length
                  ? s.priorityPeople.map((p) => `${p.name} [${p.source}]`).join(' // ')
                  : 'NONE',
              },
              { label: 'Urgent Triggers', value: s.urgentCategories.length ? s.urgentCategories.join(' // ') : 'NONE' },
              { label: 'Session Length', value: `${s.sessionDuration} MIN` },
              { label: 'Filter Level', value: s.attentionFilter.replace('_', ' ') },
              { label: 'Timezone', value: s.timezone },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1 border-l-4 border-neo-lavender bg-white/5 px-6 py-4">
                <span className="font-pixel text-sm text-neo-lavender">{label.toUpperCase()}</span>
                <span className="font-sans text-white truncate">{value.toUpperCase()}</span>
              </div>
            ))}
          </div>
          {error && <p className="font-pixel text-[#ef4444] uppercase bg-[#ef4444]/10 border-2 border-[#ef4444] p-4">{error}</p>}
        </motion.div>
      )

      default: return null
    }
  }

  const isLastStep = step === STEPS - 1

  return (
    <div className="min-h-screen bg-neo-black flex flex-col items-center justify-center p-6 pt-20">
      <div className="w-full max-w-5xl bg-neo-black border-4 border-white/10 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)] p-8 md:p-12 relative">
        {/* Header */}
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-4 border-white/10 pb-8">
          <span className="font-pixel text-2xl text-neo-lime">CONFIG_STEP_{pad(step + 1)}</span>
          <StepIndicator step={step} total={STEPS} />
        </div>

        {/* Step content */}
        <div className="min-h-[400px]">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="mt-12 pt-8 border-t-4 border-white/10 flex flex-col-reverse md:flex-row items-center justify-between gap-6">
          {step > 0 ? (
            <button type="button" onClick={back}
              className="w-full md:w-auto font-pixel text-xl border-4 border-white/20 px-8 py-3 text-white/70 hover:border-white/50 hover:text-white transition-colors neo-press">
              BACK
            </button>
          ) : <div className="hidden md:block" />}

          {isLastStep ? (
            <button type="button" onClick={submit} disabled={busy}
              className="w-full md:w-auto font-pixel text-2xl bg-neo-lime text-black border-4 border-black px-10 py-4 shadow-neo-lavender neo-press disabled:opacity-50">
              {busy ? 'SAVING...' : 'FINALIZE SYSTEM'}
            </button>
          ) : (
            <button type="button" onClick={next}
              className="w-full md:w-auto font-pixel text-2xl bg-white text-black border-4 border-black px-10 py-4 shadow-neo-lime neo-press">
              PROCEED
            </button>
          )}
        </div>

        {/* Skip */}
        {step < STEPS - 1 && (
          <div className="absolute top-4 right-4">
            <button type="button" onClick={() => setStep(STEPS - 1)} className="font-pixel text-xs text-white/30 hover:text-white transition-colors border-b border-white/30">
              SKIP TO REVIEW
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function pad(n: number) { return String(n).padStart(2, '0') }
