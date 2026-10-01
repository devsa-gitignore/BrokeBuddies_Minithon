'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const SOURCES = ['WhatsApp', 'Instagram', 'Phone calls', 'Gmail', 'Calendar', 'News']
const CALIBRATION = [
  { key: 'boss_deadline', label: 'Your manager: "Need the report by 5pm today"' },
  { key: 'promo', label: 'A shop: "Flash sale ends tonight"' },
  { key: 'friend_repeat', label: 'A friend messages three times in ten minutes' },
  { key: 'newsletter', label: 'A newsletter digest arrives' },
]
const input = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function OnboardingForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [topics, setTopics] = useState('')
  const [people, setPeople] = useState('')
  const [tz, setTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('08:00')
  const [cal, setCal] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const list = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: name || undefined,
        sourcesUsed: sources,
        settings: {
          timezone: tz,
          quiet_start: quietStart,
          quiet_end: quietEnd,
          topics: list(topics).map((topic) => ({ topic, weight: 1 })),
          priorityPeople: list(people).map((person_name) => ({ person_name, source_type: 'any', priority_weight: 15, enabled: true })),
        },
        calibration: CALIBRATION.filter((c) => c.key in cal).map((c) => ({ key: c.key, important: cal[c.key] })),
      }),
    })
    if (!res.ok) {
      setError('Could not save your setup. Check the timezone and try again.')
      setBusy(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xl space-y-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-balance">Tell us what matters</h1>
        <p className="mt-1 text-sm text-muted-foreground">Two minutes now means fewer interruptions later. You can change all of this in Settings.</p>
      </div>
      <label className="block space-y-1.5 text-sm">
        <span>Your name</span>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm">Where does your noise come from?</legend>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => {
            const on = sources.includes(s)
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setSources(on ? sources.filter((x) => x !== s) : [...sources, s])}
                className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground'}`}
              >
                {s}
              </button>
            )
          })}
        </div>
      </fieldset>
      <label className="block space-y-1.5 text-sm">
        <span>Topics you care about (comma separated)</span>
        <input className={input} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="ai, climate, football" />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span>People who always matter (comma separated)</span>
        <input className={input} value={people} onChange={(e) => setPeople(e.target.value)} placeholder="Mum, Alex" />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1.5 text-sm">
          <span>Timezone</span>
          <input className={input} value={tz} onChange={(e) => setTz(e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span>Quiet from</span>
          <input type="time" className={input} value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span>Quiet until</span>
          <input type="time" className={input} value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />
        </label>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm">Quick calibration: would you want to be interrupted?</legend>
        {CALIBRATION.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
            <span>{c.label}</span>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant={cal[c.key] === true ? 'default' : 'outline'} onClick={() => setCal({ ...cal, [c.key]: true })}>
                Yes
              </Button>
              <Button type="button" size="sm" variant={cal[c.key] === false ? 'default' : 'outline'} onClick={() => setCal({ ...cal, [c.key]: false })}>
                No
              </Button>
            </div>
          </div>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Saving...' : 'Finish setup'}
      </Button>
    </form>
  )
}
