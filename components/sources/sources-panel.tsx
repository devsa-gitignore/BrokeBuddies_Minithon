'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Zap, RefreshCcw, Webhook, Settings2, Trash2, Key, Check } from 'lucide-react'

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
    <div className="w-full space-y-8">
      {/* Header section */}
        <div className="border-4 border-black bg-neo-purple p-6 md:p-8 shadow-[8px_8px_0px_0px_#000]">
          <h1 className="font-pixel text-4xl text-black uppercase flex items-center gap-4">
            <Webhook className="w-10 h-10" /> DATA CONNECTORS
          </h1>
          <p className="mt-4 font-sans text-black/80 font-bold max-w-2xl leading-relaxed">
            Connect a phone automation (like Tasker or Shortcuts) that POSTs notification metadata to your private webhook. 
            Message bodies are evaluated but never stored permanently.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <button 
              onClick={create}
              className="flex items-center gap-2 border-4 border-black bg-neo-lime px-6 py-3 font-pixel text-sm text-black uppercase hover:-translate-y-1 transition-transform shadow-[4px_4px_0px_0px_#000]"
            >
              <Zap className="w-4 h-4" /> ADD WEBHOOK
            </button>
          </div>
          {error && (
            <div className="mt-4 border-4 border-black bg-[#ef4444] p-3 text-white font-pixel text-xs uppercase shadow-[4px_4px_0px_0px_#000]">
              ERR: {error}
            </div>
          )}
        </div>

        {/* Reveal Token Alert */}
        {reveal && (
          <div className="border-4 border-black bg-neo-lime p-6 shadow-[6px_6px_0px_0px_#000] text-black space-y-4 animate-in slide-in-from-top-4">
            <h3 className="font-pixel text-xl uppercase flex items-center gap-2">
              <Key className="w-6 h-6" /> WEBHOOK TOKEN GENERATED
            </h3>
            <p className="font-sans font-bold text-sm">
              Copy your webhook URL now. For security, it will not be shown again.
            </p>
            <div className="bg-black text-neo-lime font-mono text-sm p-4 border-2 border-black break-all select-all">
              {reveal.url}
            </div>
            <p className="font-sans text-xs font-medium opacity-80">
              EXAMPLE PAYLOAD: {'{"app":"WhatsApp","sender":"Maya","timestamp":"2026-01-10T09:30:00Z","type":"message"}'}
            </p>
          </div>
        )}

        {/* Connections List */}
        <div className="space-y-6">
          {(data?.connections ?? []).map((c) => (
            <div key={c.id} className="border-4 border-black bg-[#1a1a1a] shadow-[6px_6px_0px_0px_#CDFC8A] transition-all hover:-translate-y-1">
              {/* Card Header Color Bar */}
              <div className={`h-2 ${c.enabled ? 'bg-neo-lime' : 'bg-white/20'}`} />
              
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  
                  {/* Info Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-pixel text-xl text-white uppercase">{c.name}</h3>
                      <span className={`font-pixel text-[10px] px-2 py-1 uppercase border-2 border-black text-black ${c.status === 'live' ? 'bg-neo-lime' : c.status === 'disabled' ? 'bg-white/40' : 'bg-neo-lavender'}`}>
                        {c.status}
                      </span>
                      {!c.enabled && (
                        <span className="font-pixel text-[10px] px-2 py-1 uppercase border-2 border-black bg-[#ef4444] text-white">
                          DISABLED
                        </span>
                      )}
                    </div>
                    
                    <div className="font-sans text-sm text-white/60 space-y-1">
                      {c.token_hint && <p><span className="text-white/40 font-pixel text-[10px] uppercase mr-2">TOKEN</span> {c.token_hint}</p>}
                      <p><span className="text-white/40 font-pixel text-[10px] uppercase mr-2">EVENTS</span> {c.events_received} RECEIVED</p>
                      <p><span className="text-white/40 font-pixel text-[10px] uppercase mr-2">LAST SEEN</span> {c.last_received_at ? new Date(c.last_received_at).toLocaleString() : 'NEVER'}</p>
                    </div>

                    {c.last_error && (
                      <div className="mt-2 inline-block border-2 border-black bg-[#ef4444] px-3 py-1.5 font-sans text-xs text-white font-bold uppercase">
                        LAST ERROR: {c.last_error}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 self-start">
                    <button 
                      onClick={() => setEditingMapping(editingMapping === c.id ? null : c.id)}
                      className="border-2 border-black bg-white/10 hover:bg-white/20 px-3 py-2 font-pixel text-[10px] uppercase transition-colors"
                    >
                      <Settings2 className="w-3 h-3 inline mr-1.5" />
                      {editingMapping === c.id ? 'CLOSE MAPPING' : 'EDIT MAPPING'}
                    </button>
                    <button 
                      onClick={() => rotate(c)}
                      className="border-2 border-black bg-neo-lavender text-black hover:brightness-110 px-3 py-2 font-pixel text-[10px] uppercase transition-colors"
                    >
                      <RefreshCcw className="w-3 h-3 inline mr-1.5" /> ROTATE TOKEN
                    </button>
                    <button 
                      onClick={() => toggle(c)}
                      className={`border-2 border-black text-black px-3 py-2 font-pixel text-[10px] uppercase transition-colors ${c.enabled ? 'bg-white/60 hover:bg-white/80' : 'bg-neo-lime hover:brightness-110'}`}
                    >
                      {c.enabled ? 'DISABLE' : 'ENABLE'}
                    </button>
                    <button 
                      onClick={() => remove(c)}
                      className="border-2 border-black bg-transparent text-white/40 hover:bg-[#ef4444] hover:text-white px-3 py-2 font-pixel text-[10px] uppercase transition-colors"
                    >
                      <Trash2 className="w-3 h-3 inline mr-1.5" /> DELETE
                    </button>
                  </div>
                </div>

                {/* Mapping Editor Drawer */}
                {editingMapping === c.id && (
                  <div className="mt-6 border-t-2 border-white/10 pt-6 animate-in slide-in-from-top-2">
                    <MappingEditor 
                      initialMapping={c.payload_mapping || {}} 
                      onSave={(m) => { updateMapping(c, m); setEditingMapping(null); }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          {data && data.connections.length === 0 && (
            <div className="border-4 border-dashed border-white/20 p-12 text-center">
              <p className="font-pixel text-xl text-white/40 uppercase">NO CONNECTIONS CONFIGURED</p>
            </div>
          )}
        </div>
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
    <div className="bg-black/50 p-5 border-2 border-white/10 space-y-4">
      <div>
        <p className="font-pixel text-xs text-neo-lime uppercase mb-2">Payload Mapping (JSON)</p>
        <p className="font-sans text-xs text-white/60">
          Map internal fields to your webhook's JSON paths. Valid fields: <code className="text-neo-lavender px-1 bg-white/10">externalId, source, appName, packageName, sender, title, body, notificationType, timestamp, url</code>
        </p>
      </div>
      
      <textarea
        className="w-full h-40 rounded-none border-2 border-white/20 bg-black text-white p-4 font-mono text-sm focus:outline-none focus:border-neo-lime transition-colors"
        value={text}
        onChange={(e) => { setText(e.target.value); setErr(null); }}
        spellCheck={false}
      />
      
      <div className="flex items-center justify-between">
        {err ? (
          <p className="font-pixel text-[10px] text-[#ef4444] uppercase">ERR: {err}</p>
        ) : <div />}
        <button 
          onClick={handleSave}
          className="border-2 border-black bg-neo-lime px-4 py-2 font-pixel text-[10px] text-black uppercase hover:-translate-y-0.5 transition-transform shadow-[2px_2px_0px_0px_#000]"
        >
          <Check className="w-3 h-3 inline mr-1" /> SAVE MAPPING
        </button>
      </div>
    </div>
  )
}
