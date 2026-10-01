'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'

type Conn = {
  id: string
  source_type: string
  name: string
  status: string
  enabled: boolean
  token_hint: string | null
  last_received_at: string | null
  events_received: number
  last_error: string | null
  payload_mapping: Record<string, string>
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function SourcesPanel() {
  const { data, mutate } = useSWR<{ connections: Conn[] }>('/api/connections', fetcher)
  const [reveal, setReveal] = useState<{ url: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setError(null)
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceType: 'phone_notification', name: 'Phone notifications' }),
    })
    const j = await res.json()
    if (!res.ok) return setError('Could not create the connection.')
    setReveal({ url: `${window.location.origin}/api/ingest/${j.token}` })
    mutate()
  }

  async function toggle(c: Conn) {
    await fetch(`/api/connections/${c.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !c.enabled }),
    })
    mutate()
  }

  async function rotate(c: Conn) {
    setError(null)
    const res = await fetch(`/api/connections/${c.id}`, { method: 'POST' })
    const j = await res.json()
    if (!res.ok) return setError('Could not rotate token.')
    setReveal({ url: `${window.location.origin}/api/ingest/${j.token}` })
    mutate()
  }

  async function remove(c: Conn) {
    await fetch(`/api/connections/${c.id}`, { method: 'DELETE' })
    mutate()
  }

  async function updateMapping(c: Conn, mapping: Record<string, string>) {
    await fetch(`/api/connections/${c.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payloadMapping: mapping }),
    })
    mutate()
  }

  const [editingMapping, setEditingMapping] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Sources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a phone automation (for example Tasker or Shortcuts) that POSTs notification metadata to your private webhook. Message bodies are never stored.
        </p>
      </div>
      <Button onClick={create}>Add phone webhook</Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {reveal && (
        <div role="status" className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-medium">Copy your webhook URL now. It will not be shown again.</p>
          <code className="block break-all rounded bg-muted p-2 text-xs">{reveal.url}</code>
          <p className="text-xs text-muted-foreground">
            POST JSON such as {'{"app":"WhatsApp","sender":"Maya","timestamp":"2026-01-10T09:30:00Z","type":"message"}'}.
          </p>
        </div>
      )}
      <ul className="space-y-3">
        {(data?.connections ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <div className="text-sm">
              <p className="font-medium">
                {c.name} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">{c.status}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {c.token_hint ? `Token ${c.token_hint} · ` : ''}
                {c.events_received} received
                {c.last_received_at ? ` · last ${new Date(c.last_received_at).toLocaleString()}` : ' · nothing received yet'}
              </p>
              {c.last_error && <p className="text-xs text-destructive">Last error: {c.last_error}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingMapping(editingMapping === c.id ? null : c.id)}>
                {editingMapping === c.id ? 'Close mapping' : 'Edit mapping'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => rotate(c)}>
                Rotate token
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggle(c)}>
                {c.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(c)}>
                Delete
              </Button>
            </div>
            {editingMapping === c.id && (
              <MappingEditor 
                initialMapping={c.payload_mapping || {}} 
                onSave={(m) => { updateMapping(c, m); setEditingMapping(null); }}
              />
            )}
          </li>
        ))}
        {data && data.connections.length === 0 && <li className="text-sm text-muted-foreground">No sources connected yet.</li>}
      </ul>
    </div>
  )
}

function MappingEditor({ initialMapping, onSave }: { initialMapping: Record<string, string>; onSave: (m: Record<string, string>) => void }) {
  const [text, setText] = useState(() => JSON.stringify(initialMapping, null, 2))
  const [err, setErr] = useState<string | null>(null)

  function handleSave() {
    try {
      const parsed = JSON.parse(text)
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        throw new Error('Must be a JSON object')
      }
      onSave(parsed)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="mt-4 w-full space-y-2 rounded border bg-muted/50 p-4">
      <p className="text-xs font-medium">Payload Mapping (JSON)</p>
      <p className="text-xs text-muted-foreground">
        Map internal fields to your webhook's JSON paths. Valid fields: <code className="text-[10px]">externalId, source, appName, packageName, sender, title, body, notificationType, timestamp, url</code>
      </p>
      <textarea
        className="w-full h-32 rounded border bg-background p-2 text-xs font-mono"
        value={text}
        onChange={(e) => { setText(e.target.value); setErr(null); }}
      />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button size="sm" onClick={handleSave}>Save mapping</Button>
    </div>
  )
}
