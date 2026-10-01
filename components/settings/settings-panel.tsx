'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Save, RefreshCw } from 'lucide-react'

type Prefs = {
  topics: { topic: string; weight: number }[]
  keywords: { keyword: string; weight: number }[]
  priorityPeople: { person_name: string; sender_identifier: string | null; source_type: string; priority_weight: number; enabled: boolean }[]
  settings: {
    timezone: string
    quiet_start: string
    quiet_end: string
    digest_time: string
    meeting_lead_minutes: number
    deadline_lead_hours: number
    interruption_budget: number
    current_mode: 'normal' | 'focus' | 'quiet'
    session_duration_minutes: number
    attention_filter: 'all' | 'important' | 'urgent_only'
    breaking_news_topics: string[]
    urgent_categories: string[]
    job_search: Record<string, any> | null
  }
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())
const input = 'w-full rounded-none border-2 border-black bg-white px-3 py-2 text-2xl text-black outline-none focus-visible:ring-0 focus-visible:border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all'
const select = 'w-full rounded-none border-2 border-black bg-white px-3 py-2 text-2xl text-black outline-none focus-visible:ring-0 focus-visible:border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all'
const labelCls = 'block space-y-1.5 text-2xl font-bold uppercase tracking-tight text-black'

export function SettingsPanel() {
  const { data, mutate } = useSWR<{ prefs: Prefs }>('/api/settings', fetcher)
  const [s, setS] = useState<Prefs['settings'] | null>(null)
  
  const [topics, setTopics] = useState('')
  const [keywords, setKeywords] = useState('')
  const [people, setPeople] = useState('')
  const [breakingNews, setBreakingNews] = useState('')
  const [urgentCategories, setUrgentCategories] = useState('')
  const [jobSearchRole, setJobSearchRole] = useState('')
  const [jobSearchLevel, setJobSearchLevel] = useState('any')
  const [jobSearchRemote, setJobSearchRemote] = useState('any')

  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    setS(data.prefs.settings)
    setTopics(data.prefs.topics.map((t) => t.topic).join(', '))
    setKeywords(data.prefs.keywords.map((k) => k.keyword).join(', '))
    setPeople(data.prefs.priorityPeople.map((p) => p.person_name).join(', '))
    setBreakingNews(data.prefs.settings.breaking_news_topics?.join(', ') || '')
    setUrgentCategories(data.prefs.settings.urgent_categories?.join(', ') || '')
    setJobSearchRole(data.prefs.settings.job_search?.role || '')
    setJobSearchLevel(data.prefs.settings.job_search?.level || 'any')
    setJobSearchRemote(data.prefs.settings.job_search?.remote || 'any')
  }, [data])

  if (!s) return <div className="p-8 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-neo-purple" /></div>

  const list = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean)
  const set = <K extends keyof Prefs['settings']>(k: K, v: Prefs['settings'][K]) => setS({ ...s, [k]: v })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!s) return
    setMsg('Saving...')
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...s,
        breaking_news_topics: list(breakingNews),
        urgent_categories: list(urgentCategories),
        job_search: {
          role: jobSearchRole || undefined,
          level: jobSearchLevel,
          remote: jobSearchRemote
        },
        topics: list(topics).map((topic) => ({ topic, weight: 1 })),
        keywords: list(keywords).map((keyword) => ({ keyword, weight: 1 })),
        priorityPeople: list(people).map((person_name) => ({ person_name, source_type: 'any', priority_weight: 15, enabled: true })),
      }),
    })
    setMsg(res.ok ? 'Saved successfully! Your feeds are being re-evaluated.' : 'Could not save. Check the values and try again.')
    mutate()
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-4xl space-y-10 pb-20">
      <div className="flex items-center justify-between border-b-4 border-black pb-4">
        <div>
          <h1 className="text-6xl font-black uppercase tracking-tighter text-white">System Settings</h1>
          <p className="text-2xl text-muted-foreground font-medium mt-1">Configure your attention filters and preferences.</p>
        </div>
        <Button type="submit" size="lg" className="rounded-none border-2 border-black bg-neo-lime text-black hover:bg-neo-lime/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wider">
          <Save className="mr-2 h-4 w-4" /> Save Changes
        </Button>
      </div>
      
      {msg && (
        <div className={`p-4 border-2 border-black font-bold uppercase tracking-wide shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${msg.includes('successfully') ? 'bg-neo-lime text-black' : 'bg-red-500 text-white'}`}>
          {msg}
        </div>
      )}

      {/* Grid for Modes & Schedules */}
      <section className="space-y-6">
        <h2 className="text-5xl font-black uppercase tracking-tight">Modes & Schedules</h2>
        <div className="grid gap-6 sm:grid-cols-2 bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <label className={labelCls}>
            <span>Timezone (IANA)</span>
            <input className={input} value={s.timezone} onChange={(e) => set('timezone', e.target.value)} />
          </label>
          <label className={labelCls}>
            <span>Current Mode</span>
            <select className={select} value={s.current_mode} onChange={(e) => set('current_mode', e.target.value as any)}>
              <option value="normal">Normal</option>
              <option value="focus">Focus</option>
              <option value="quiet">Quiet</option>
            </select>
          </label>
          <label className={labelCls}>
            <span>Attention Filter</span>
            <select className={select} value={s.attention_filter} onChange={(e) => set('attention_filter', e.target.value as any)}>
              <option value="all">All Items</option>
              <option value="important">Important Only</option>
              <option value="urgent_only">Urgent Only</option>
            </select>
          </label>
          <label className={labelCls}>
            <span>Max Session Duration (mins)</span>
            <input type="number" min={5} max={180} className={input} value={s.session_duration_minutes} onChange={(e) => set('session_duration_minutes', Number(e.target.value))} />
          </label>
          <label className={labelCls}>
            <span>Quiet Hours Start</span>
            <input type="time" className={input} value={s.quiet_start} onChange={(e) => set('quiet_start', e.target.value)} />
          </label>
          <label className={labelCls}>
            <span>Quiet Hours End</span>
            <input type="time" className={input} value={s.quiet_end} onChange={(e) => set('quiet_end', e.target.value)} />
          </label>
        </div>
      </section>

      {/* Grid for Categories & Topics */}
      <section className="space-y-6">
        <h2 className="text-5xl font-black uppercase tracking-tight">Focus & Categories</h2>
        <div className="grid gap-6 bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <label className={labelCls}>
            <span>Topics (comma separated)</span>
            <textarea rows={2} className={input} value={topics} onChange={(e) => setTopics(e.target.value)} />
          </label>
          <label className={labelCls}>
            <span>Keywords (comma separated)</span>
            <textarea rows={2} className={input} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </label>
          <label className={labelCls}>
            <span>Priority People (comma separated names)</span>
            <textarea rows={2} className={input} value={people} onChange={(e) => setPeople(e.target.value)} />
          </label>
          <label className={labelCls}>
            <span>Urgent Categories (comma separated)</span>
            <textarea rows={2} className={input} value={urgentCategories} onChange={(e) => setUrgentCategories(e.target.value)} />
          </label>
          <label className={labelCls}>
            <span>Breaking News Topics (comma separated)</span>
            <textarea rows={2} className={input} value={breakingNews} onChange={(e) => setBreakingNews(e.target.value)} />
          </label>
        </div>
      </section>

      {/* Job Search Preferences */}
      <section className="space-y-6">
        <h2 className="text-5xl font-black uppercase tracking-tight">Job Search Radar</h2>
        <div className="grid gap-6 sm:grid-cols-3 bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <label className={labelCls}>
            <span>Target Role</span>
            <input className={input} placeholder="e.g. Frontend Developer" value={jobSearchRole} onChange={(e) => setJobSearchRole(e.target.value)} />
          </label>
          <label className={labelCls}>
            <span>Level</span>
            <select className={select} value={jobSearchLevel} onChange={(e) => setJobSearchLevel(e.target.value)}>
              <option value="any">Any Level</option>
              <option value="entry">Entry Level</option>
              <option value="mid">Mid Level</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead/Manager</option>
            </select>
          </label>
          <label className={labelCls}>
            <span>Work Style</span>
            <select className={select} value={jobSearchRemote} onChange={(e) => setJobSearchRemote(e.target.value)}>
              <option value="any">Any</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </label>
        </div>
      </section>
      
      {/* Grid for Legacy Notifications Limits */}
      <section className="space-y-6">
        <h2 className="text-5xl font-black uppercase tracking-tight text-gray-400">Legacy Notification Limits</h2>
        <div className="grid gap-6 sm:grid-cols-2 bg-gray-100 border-2 border-gray-300 p-6 shadow-[4px_4px_0px_0px_rgba(156,163,175,1)]">
          <label className={`${labelCls} text-gray-500`}>
            <span>Daily digest time</span>
            <input type="time" className={`${input} !border-gray-400`} value={s.digest_time} onChange={(e) => set('digest_time', e.target.value)} />
          </label>
          <label className={`${labelCls} text-gray-500`}>
            <span>Interruptions per day</span>
            <input type="number" min={0} max={50} className={`${input} !border-gray-400`} value={s.interruption_budget} onChange={(e) => set('interruption_budget', Number(e.target.value))} />
          </label>
          <label className={`${labelCls} text-gray-500`}>
            <span>Meeting reminder lead (minutes)</span>
            <input type="number" min={0} className={`${input} !border-gray-400`} value={s.meeting_lead_minutes} onChange={(e) => set('meeting_lead_minutes', Number(e.target.value))} />
          </label>
          <label className={`${labelCls} text-gray-500`}>
            <span>Deadline reminder lead (hours)</span>
            <input type="number" min={0} className={`${input} !border-gray-400`} value={s.deadline_lead_hours} onChange={(e) => set('deadline_lead_hours', Number(e.target.value))} />
          </label>
        </div>
      </section>
      
      <div className="pt-6 border-t-4 border-black flex justify-end">
        <Button type="submit" size="lg" className="rounded-none border-2 border-black bg-neo-lime text-black hover:bg-neo-lime/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wider">
          <Save className="mr-2 h-4 w-4" /> Save Changes
        </Button>
      </div>
    </form>
  )
}
