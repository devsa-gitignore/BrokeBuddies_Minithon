'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'

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
  }
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())
const input = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function SettingsPanel() {
  const { data, mutate } = useSWR<{ prefs: Prefs }>('/api/settings', fetcher)
  const [s, setS] = useState<Prefs['settings'] | null>(null)
  const [topics, setTopics] = useState('')
  const [keywords, setKeywords] = useState('')
  const [people, setPeople] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    setS(data.prefs.settings)
    setTopics(data.prefs.topics.map((t) => t.topic).join(', '))
    setKeywords(data.prefs.keywords.map((k) => k.keyword).join(', '))
    setPeople(data.prefs.priorityPeople.map((p) => p.person_name).join(', '))
  }, [data])

  if (!s) return <p className="text-sm text-muted-foreground">Loading...</p>

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
        topics: list(topics).map((topic) => ({ topic, weight: 1 })),
        keywords: list(keywords).map((keyword) => ({ keyword, weight: 1 })),
        priorityPeople: list(people).map((person_name) => ({ person_name, source_type: 'any', priority_weight: 15, enabled: true })),
      }),
    })
    setMsg(res.ok ? 'Saved. Your feeds were re-evaluated.' : 'Could not save. Check the values and try again.')
    mutate()
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span>Timezone (IANA)</span>
          <input className={input} value={s.timezone} onChange={(e) => set('timezone', e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span>Mode</span>
          <select className={input} value={s.current_mode} onChange={(e) => set('current_mode', e.target.value as Prefs['settings']['current_mode'])}>
            <option value="normal">Normal</option>
            <option value="focus">Focus</option>
            <option value="quiet">Quiet</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span>Quiet hours start</span>
          <input type="time" className={input} value={s.quiet_start} onChange={(e) => set('quiet_start', e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span>Quiet hours end</span>
          <input type="time" className={input} value={s.quiet_end} onChange={(e) => set('quiet_end', e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span>Daily digest time</span>
          <input type="time" className={input} value={s.digest_time} onChange={(e) => set('digest_time', e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span>Interruptions per day</span>
          <input type="number" min={0} max={50} className={input} value={s.interruption_budget} onChange={(e) => set('interruption_budget', Number(e.target.value))} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span>Meeting reminder lead (minutes)</span>
          <input type="number" min={0} className={input} value={s.meeting_lead_minutes} onChange={(e) => set('meeting_lead_minutes', Number(e.target.value))} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span>Deadline reminder lead (hours)</span>
          <input type="number" min={0} className={input} value={s.deadline_lead_hours} onChange={(e) => set('deadline_lead_hours', Number(e.target.value))} />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm">
        <span>Topics (comma separated)</span>
        <input className={input} value={topics} onChange={(e) => setTopics(e.target.value)} />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span>Keywords (comma separated)</span>
        <input className={input} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span>Priority people (comma separated names)</span>
        <input className={input} value={people} onChange={(e) => setPeople(e.target.value)} />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit">Save settings</Button>
        {msg && (
          <span role="status" className="text-sm text-muted-foreground">
            {msg}
          </span>
        )}
      </div>
    </form>
  )
}
