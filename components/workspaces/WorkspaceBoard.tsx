'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import '@/components/workspaces/workspaces.css'
import type {
  WorkspaceChatRow,
  WorkspaceNotesRow,
  WorkspaceOrganizationRow,
  WorkspaceResourceRow,
  WorkspaceRow,
} from '@/types/workspace'

// ──────────────────────────────────────────────
// Resource chip
// ──────────────────────────────────────────────
function ResourceChip({ resource }: { resource: WorkspaceResourceRow }) {
  const TYPE_LABELS: Record<string, string> = {
    youtube: 'YT', reddit: 'RD', github: 'GH',
    article: 'AR', pdf: 'PD', other_url: 'LK',
  }
  return (
    <a
      href={resource.url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 border border-[#CDFC8A] px-2 py-0.5 font-mono text-[10px] text-[#CDFC8A] hover:translate-x-0.5 transition-transform duration-100 hover:bg-[#CDFC8A]/10"
      title={resource.title ?? resource.url ?? ''}
    >
      <span className="text-[#888888]">[{TYPE_LABELS[resource.resource_type] ?? 'LK'}]</span>
      <span className="max-w-[180px] truncate">{resource.title ?? resource.url}</span>
      <span>↗</span>
    </a>
  )
}

// ──────────────────────────────────────────────
// Mermaid diagram panel
// ──────────────────────────────────────────────
function DiagramPanel({ mermaid, title }: { mermaid: string; title: string }) {
  const [svgContent, setSvgContent] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    import('mermaid').then(({ default: m }) => {
      m.initialize({ startOnLoad: false, theme: 'dark' })
      const id = `ws-diagram-${Date.now()}`
      m.render(id, mermaid).then(({ svg }: { svg: string }) => {
        if (!cancelled) {
          setSvgContent(svg)
        }
      }).catch(console.error)
    })
    return () => { cancelled = true }
  }, [mermaid])

  return (
    <div>
      <p className="font-mono text-[10px] text-[#888888] uppercase tracking-widest mb-2">{title}</p>
      <div
        className="border border-[#2a2a2a] bg-[#0d0d0d] p-4 transition-opacity duration-300 overflow-auto"
        style={{ opacity: svgContent ? 1 : 0.3, minHeight: 180 }}
      >
        {!svgContent ? (
          <p className="font-mono text-xs text-[#444444]">RENDERING DIAGRAM...</p>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: svgContent }} />
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Processing overlay
// ──────────────────────────────────────────────
const STEP_LABELS = ['extracting','context','classify','organize','synthesize','visualize','sourcecheck','saving','done']

function ProcessingOverlay({ workspaceId, onDone }: { workspaceId: string; onDone: () => void }) {
  const [step, setStep] = useState<string>('extracting')
  const [stepIndex, setStepIndex] = useState(0)
  const spinnerChars = ['|', '/', '-', '\\']
  const [spinIdx, setSpinIdx] = useState(0)

  useEffect(() => {
    const spinTimer = setInterval(() => setSpinIdx(i => (i + 1) % 4), 120)
    return () => clearInterval(spinTimer)
  }, [])

  useEffect(() => {
    const es = new EventSource(`/api/workspaces/${workspaceId}/process`, { withCredentials: true })
    // EventSource doesn't support POST natively — we use fetch + ReadableStream instead
    es.close()

    let done = false
    fetch(`/api/workspaces/${workspaceId}/process`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        if (!reader) return
        while (!done) {
          const { value, done: streamDone } = await reader.read()
          if (streamDone) break
          const text = decoder.decode(value)
          for (const line of text.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const prog = JSON.parse(line.slice(6))
                setStep(prog.step)
                setStepIndex(prog.stepIndex)
                if (prog.step === 'done' || prog.step === 'failed') {
                  done = true
                  setTimeout(onDone, 800)
                }
              } catch { /* */ }
            }
          }
        }
      })
      .catch(console.error)

    return () => { done = true }
  }, [workspaceId, onDone])

  const pct = Math.round((stepIndex / 8) * 100)

  return (
    <div className="border border-[#2a2a2a] bg-[#0d0d0d] p-6 font-mono">
      <p className="text-[#888888] text-xs uppercase tracking-widest mb-4">PROCESSING WORKSPACE...</p>
      <div className="h-[2px] bg-[#1a1a1a] mb-4">
        <div
          className="h-full bg-[#CDFC8A] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="space-y-1.5">
        {STEP_LABELS.map((s, i) => (
          <div key={s} className="flex items-center gap-3 text-xs">
            <span className={[
              'w-4',
              i < stepIndex ? 'text-[#CDFC8A]' :
              i === stepIndex ? 'text-[#CDFC8A]' : 'text-[#333333]'
            ].join(' ')}>
              {i < stepIndex ? '✓' : i === stepIndex ? spinnerChars[spinIdx] : '·'}
            </span>
            <span className={i <= stepIndex ? 'text-[#D2CBFE]' : 'text-[#333333]'}>
              → {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Chat sidebar
// ──────────────────────────────────────────────
function ChatSidebar({ workspaceId, initialMessages }: { workspaceId: string; initialMessages: WorkspaceChatRow[] }) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setLoading(true)
    setMessages(m => [...m, { id: Date.now().toString(), workspace_id: workspaceId, user_id: '', role: 'user', content: userMsg, model_used: null, created_at: new Date().toISOString() }])

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      })
      const data = await res.json()
      setMessages(m => [...m, { id: (Date.now() + 1).toString(), workspace_id: workspaceId, user_id: '', role: 'assistant', content: data.reply, model_used: null, created_at: new Date().toISOString() }])
    } catch {
      setMessages(m => [...m, { id: (Date.now() + 1).toString(), workspace_id: workspaceId, user_id: '', role: 'assistant', content: 'Error — could not reach the assistant.', model_used: null, created_at: new Date().toISOString() }])
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full border-r border-[#2a2a2a] bg-[#0d0d0d]">
      <div className="px-3 py-3 border-b border-[#2a2a2a]">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#888888]">CHAT</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="font-mono text-[10px] text-[#333333] text-center mt-8">
            Ask anything about this workspace...
          </p>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className="border-l-2 pl-2 py-1"
            style={{
              borderColor: m.role === 'user' ? '#CDFC8A' : '#D2CBFE',
              animation: 'ws-chat-in 0.15s ease-out',
            }}
          >
            <p className="font-mono text-[10px] text-[#444444] uppercase mb-1">
              {m.role === 'user' ? 'YOU' : 'ASSISTANT'}
            </p>
            <p className="font-mono text-xs text-[#D2CBFE] leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
          </div>
        ))}
        {loading && (
          <div className="border-l-2 border-[#D2CBFE] pl-2 py-1">
            <p className="font-mono text-[10px] text-[#444444] uppercase mb-1">ASSISTANT</p>
            <p className="font-mono text-xs text-[#444444] animate-pulse">thinking...</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#2a2a2a] p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="ask..."
          className="flex-1 bg-[#111111] border border-[#2a2a2a] font-mono text-xs text-[#D2CBFE] px-3 py-2 outline-none focus:border-[#D2CBFE] placeholder:text-[#333333] transition-colors"
        />
        <button
          onClick={send}
          disabled={loading}
          className="font-mono text-xs text-[#0a0a0a] bg-[#CDFC8A] px-3 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity uppercase tracking-widest"
        >
          ASK →
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Notes sidebar
// ──────────────────────────────────────────────
function NotesSidebar({ workspaceId, initialNotes }: { workspaceId: string; initialNotes: WorkspaceNotesRow | null }) {
  const [content, setContent] = useState(initialNotes?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(v: string) {
    setContent(v)
    setSaved(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(save, 1500) // auto-save after 1.5s
  }

  async function save() {
    setSaving(true)
    await fetch(`/api/workspaces/${workspaceId}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="flex flex-col h-full border-l border-[#2a2a2a] bg-[#0d0d0d]">
      <div className="px-3 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#888888]">NOTES</p>
        <button
          onClick={save}
          className="font-mono text-[10px] uppercase tracking-widest text-[#444444] hover:text-[#888888] transition-colors"
        >
          {saving ? 'SAVING...' : saved ? 'SAVED ✓' : 'SAVE'}
        </button>
      </div>

      <textarea
        value={content}
        onChange={e => handleChange(e.target.value)}
        placeholder="your notes..."
        className="flex-1 bg-transparent font-mono text-xs text-[#D2CBFE] p-4 outline-none resize-none placeholder:text-[#333333] leading-relaxed"
      />
    </div>
  )
}

// ──────────────────────────────────────────────
// Add Resource panel
// ──────────────────────────────────────────────
function AddResourcePanel({
  workspaceId,
  resourceCount,
  onAdded,
}: {
  workspaceId: string
  resourceCount: number
  onAdded: (r: WorkspaceResourceRow) => void
}) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    if (!url.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? 'Failed to add resource')
      setUrl('')
      onAdded(data.resource)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    }
    setLoading(false)
  }

  return (
    <div className="border border-[#2a2a2a] bg-[#0d0d0d] p-6 shadow-md transition-all hover:shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-xs text-[#888888] uppercase tracking-widest">ADD RESOURCE</p>
        <p className="font-mono text-xs text-[#444444]">{resourceCount}/30</p>
      </div>
      <div className="flex gap-4">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="paste a URL, YouTube link, GitHub repo, or PDF link..."
          className="flex-1 bg-[#111111] border border-[#2a2a2a] font-mono text-sm text-[#D2CBFE] px-4 py-3 outline-none focus:border-[#D2CBFE] placeholder:text-[#333333] transition-colors"
          disabled={resourceCount >= 30}
        />
        <button
          onClick={add}
          disabled={!url.trim() || loading || resourceCount >= 30}
          className="font-mono text-sm uppercase tracking-widest px-6 py-3 border border-[#CDFC8A] text-[#CDFC8A] hover:bg-[#CDFC8A] hover:text-[#0a0a0a] transition-colors disabled:border-[#2a2a2a] disabled:text-[#444444] disabled:cursor-not-allowed"
        >
          {loading ? '...' : 'ADD'}
        </button>
      </div>
      {error && <p className="font-mono text-xs text-[#ff4444] mt-3">{error}</p>}
      {resourceCount >= 30 && <p className="font-mono text-xs text-[#ff4444] mt-3">WORKSPACE IS FULL (30/30)</p>}
    </div>
  )
}

// ──────────────────────────────────────────────
// Main Board
// ──────────────────────────────────────────────
export function WorkspaceBoard({
  workspace: initialWorkspace,
  organization: initialOrg,
  resources: initialResources,
  messages: initialMessages,
  notes: initialNotes,
}: {
  workspace: WorkspaceRow
  organization: WorkspaceOrganizationRow | null
  resources: WorkspaceResourceRow[]
  messages: WorkspaceChatRow[]
  notes: WorkspaceNotesRow | null
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace)
  const [org, setOrg] = useState(initialOrg)
  const [resources, setResources] = useState(initialResources)
  const [processing, setProcessing] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const [notesOpen, setNotesOpen] = useState(true)

  async function refreshWorkspace() {
    const res = await fetch(`/api/workspaces/${workspace.id}`)
    if (res.ok) {
      const data = await res.json()
      setWorkspace(data.workspace)
      setOrg(data.organization)
      setResources(data.resources)
    }
    setProcessing(false)
  }

  const readFirstResources = (org?.synthesis?.what_to_read_first ?? [])
    .map(id => resources.find(r => r.id === id))
    .filter(Boolean) as WorkspaceResourceRow[]

  return (
    <div className="ws-full-viewport min-h-screen bg-[#0a0a0a] flex flex-col" style={{ fontFamily: "'JetBrains Mono', monospace" }}>

      {/* Top bar */}
      <div className="border-b border-[#2a2a2a] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/workspaces" className="font-mono text-sm text-[#888888] hover:text-[#D2CBFE] uppercase tracking-widest transition-colors">
            ← WORKSPACES
          </Link>
          <span className="text-[#2a2a2a]">|</span>
          <h1 className="font-mono font-bold text-xs text-[#D2CBFE] uppercase tracking-wide">{workspace.title}</h1>
          <span className="font-mono text-sm text-[#888888]">
            {workspace.domain} · {workspace.resource_count}/30 resources · {workspace.org_status}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setProcessing(true)}
            disabled={processing || resources.length === 0}
            className="font-mono text-sm uppercase tracking-widest px-6 py-2 border border-[#3C183C] text-[#888888] hover:border-[#D2CBFE] hover:text-[#D2CBFE] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {processing ? 'RUNNING...' : '[REGENERATE]'}
          </button>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 73px)' }}>

        {/* Chat sidebar */}
        <div className={`transition-all duration-200 overflow-hidden flex-shrink-0 ${chatOpen ? 'w-64' : 'w-8'}`}>
          {chatOpen ? (
            <div className="relative h-full">
              <button
                onClick={() => setChatOpen(false)}
                className="absolute top-3 right-3 font-mono text-[10px] text-[#444444] hover:text-[#888888] z-10"
              >
                ←
              </button>
              <ChatSidebar workspaceId={workspace.id} initialMessages={initialMessages} />
            </div>
          ) : (
            <button
              onClick={() => setChatOpen(true)}
              className="h-full w-8 border-r border-[#2a2a2a] flex items-center justify-center hover:bg-[#111111] transition-colors"
              title="Open chat"
            >
              <span className="font-mono text-[10px] text-[#444444] uppercase writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>
                CHAT →
              </span>
            </button>
          )}
        </div>

        {/* Main board */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* Add resource */}
          <AddResourcePanel
            workspaceId={workspace.id}
            resourceCount={workspace.resource_count}
            onAdded={(r) => {
              setResources(prev => [...prev, r])
              setWorkspace(w => ({ ...w, resource_count: w.resource_count + 1 }))
            }}
          />

          {/* Processing overlay */}
          {processing && (
            <ProcessingOverlay workspaceId={workspace.id} onDone={refreshWorkspace} />
          )}

          {/* No resources yet */}
          {resources.length === 0 && !processing && (
            <div className="border border-dashed border-[#2a2a2a] p-8 text-center">
              <p className="font-mono text-sm text-[#444444] uppercase tracking-widest mb-2">NO RESOURCES YET</p>
              <p className="font-mono text-xs text-[#333333]">Add URLs above, then click Regenerate to organize them.</p>
            </div>
          )}

          {/* Overview */}
          {org?.synthesis?.overview && (
            <div
              className="space-y-3"
              style={{ animation: 'ws-card-fade-in 0.3s ease-out 0.1s both' }}
            >
              <p className="font-mono text-xs text-[#888888] uppercase tracking-widest border-b border-[#2a2a2a] pb-2">
                OVERVIEW
              </p>
              <p className="font-mono text-base text-[#D2CBFE] leading-relaxed">{org.synthesis.overview}</p>
              {org.synthesis.key_concepts?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {org.synthesis.key_concepts.map(c => (
                    <span key={c} className="font-mono text-xs px-3 py-1 border border-[#2a2a2a] text-[#888888] hover:text-[#D2CBFE] hover:border-[#D2CBFE] transition-colors cursor-default">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Diagram */}
          {org?.diagram_mermaid && (
            <div style={{ animation: 'ws-card-fade-in 0.3s ease-out 0.2s both' }}>
              <p className="font-mono text-[10px] text-[#888888] uppercase tracking-widest border-b border-[#2a2a2a] pb-2 mb-3">
                DIAGRAM
              </p>
              <DiagramPanel mermaid={org.diagram_mermaid} title={org.diagram_title ?? ''} />
            </div>
          )}

          {/* Sections */}
          {org?.sections && org.sections.length > 0 && (
            <div style={{ animation: 'ws-card-fade-in 0.3s ease-out 0.3s both' }}>
              <p className="font-mono text-xs text-[#888888] uppercase tracking-widest border-b border-[#2a2a2a] pb-2 mb-4">
                SECTIONS
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {org.sections.map((section, i) => {
                  const sectionResources = section.resource_ids
                    .map(rid => resources.find(r => r.id === rid))
                    .filter(Boolean) as WorkspaceResourceRow[]
                  return (
                    <div
                      key={section.id}
                      className="border border-[#2a2a2a] bg-[#022E21] hover:border-[#ffffff] transition-colors duration-200"
                      style={{ animation: `ws-card-fade-in 0.3s ease-out ${0.3 + i * 0.08}s both` }}
                    >
                      <div className="h-[3px] bg-[#3C183C]" />
                      <div className="p-5">
                        <h3 className="font-mono font-bold text-base text-[#D2CBFE] uppercase tracking-wide mb-3">{section.title}</h3>
                        <p className="font-mono text-sm text-[#888888] leading-relaxed mb-4">{section.summary}</p>
                        <div className="flex flex-wrap gap-2">
                          {sectionResources.map(r => (
                            <ResourceChip key={r.id} resource={r} />
                          ))}
                          {sectionResources.length === 0 && (
                            <span className="font-mono text-xs text-[#333333]">no resources assigned</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Start Here */}
          {readFirstResources.length > 0 && (
            <div style={{ animation: 'ws-card-fade-in 0.3s ease-out 0.5s both' }}>
              <p className="font-mono text-[10px] text-[#888888] uppercase tracking-widest border-b border-[#2a2a2a] pb-2 mb-3">
                START HERE
              </p>
              <div className="space-y-2">
                {readFirstResources.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[#444444]">{i + 1}.</span>
                    <a
                      href={r.url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[#CDFC8A] hover:underline flex items-center gap-2"
                    >
                      <span className="text-[#888888] text-[10px] uppercase border border-[#2a2a2a] px-1">
                        {r.resource_type}
                      </span>
                      {r.title ?? r.url}
                      <span>↗</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All resources (if no org yet) */}
          {resources.length > 0 && !org && (
            <div>
              <p className="font-mono text-[10px] text-[#888888] uppercase tracking-widest border-b border-[#2a2a2a] pb-2 mb-3">
                RESOURCES ({resources.length})
              </p>
              <div className="space-y-1.5">
                {resources.map(r => <ResourceChip key={r.id} resource={r} />)}
              </div>
              <div className="mt-4 border border-[#2a2a2a] p-4 bg-[#0d0d0d]">
                <p className="font-mono text-xs text-[#888888] mb-3">
                  Click <strong className="text-[#D2CBFE]">[REGENERATE]</strong> to organize these resources using AI.
                </p>
                <button
                  onClick={() => setProcessing(true)}
                  className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-[#CDFC8A] text-[#CDFC8A] hover:bg-[#CDFC8A] hover:text-[#0a0a0a] transition-colors"
                >
                  PROCESS NOW →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notes sidebar */}
        <div className={`transition-all duration-200 overflow-hidden flex-shrink-0 ${notesOpen ? 'w-56' : 'w-8'}`}>
          {notesOpen ? (
            <div className="relative h-full">
              <button
                onClick={() => setNotesOpen(false)}
                className="absolute top-3 left-3 font-mono text-[10px] text-[#444444] hover:text-[#888888] z-10"
              >
                →
              </button>
              <NotesSidebar workspaceId={workspace.id} initialNotes={initialNotes} />
            </div>
          ) : (
            <button
              onClick={() => setNotesOpen(true)}
              className="h-full w-8 border-l border-[#2a2a2a] flex items-center justify-center hover:bg-[#111111] transition-colors"
              title="Open notes"
            >
              <span className="font-mono text-[10px] text-[#444444] uppercase" style={{ writingMode: 'vertical-rl' }}>
                ← NOTES
              </span>
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
