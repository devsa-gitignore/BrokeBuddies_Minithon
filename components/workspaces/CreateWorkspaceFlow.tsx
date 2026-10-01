'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import '@/components/workspaces/workspaces.css'
import type { WorkspaceDomain, WorkspaceIntent } from '@/types/workspace'

const INTENTS: { value: WorkspaceIntent; label: string; description: string }[] = [
  { value: 'teach_me',      label: 'TEACH ME THIS',       description: 'Explain from scratch, fundamentals first' },
  { value: 'study_plan',    label: 'STUDY PLAN',          description: 'Structured learning path with milestones' },
  { value: 'research_deep', label: 'DEEP RESEARCH',       description: 'Map the topic, evidence, and open questions' },
  { value: 'code_guide',    label: 'CODE WALKTHROUGH',    description: 'Architecture, patterns, and reference' },
  { value: 'custom',        label: 'SOMETHING ELSE',      description: 'I\'ll describe what I need' },
]

const DOMAINS: { value: WorkspaceDomain; label: string }[] = [
  { value: 'research', label: 'RESEARCH' },
  { value: 'study',    label: 'STUDY' },
  { value: 'code',     label: 'CODE' },
]

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={[
            'w-6 h-6 font-mono text-xs flex items-center justify-center border transition-colors duration-100',
            i < current  ? 'border-[#CDFC8A] bg-[#CDFC8A] text-[#0a0a0a]' :
            i === current ? 'border-[#CDFC8A] text-[#CDFC8A]' :
                           'border-[#2a2a2a] text-[#444444]',
          ].join(' ')}>
            {i < current ? '✓' : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-8 h-[1px] transition-colors duration-300 ${i < current ? 'bg-[#CDFC8A]' : 'bg-[#2a2a2a]'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export function CreateWorkspaceFlow() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [domain, setDomain] = useState<WorkspaceDomain | null>(null)
  const [intent, setIntent] = useState<WorkspaceIntent | null>(null)
  const [intentNote, setIntentNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    if (!domain || !intent || !title || !subject) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, subject, intent, intent_note: intentNote || undefined, domain }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? 'Failed to create workspace')
      router.push(`/workspaces/${data.workspace.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="ws-full-viewport min-h-screen bg-[#0a0a0a] px-8 py-16">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10">
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
          className="font-mono text-xs text-[#888888] hover:text-[#D2CBFE] uppercase tracking-widest mb-6 flex items-center gap-2 transition-colors"
        >
          ← BACK
        </button>
        <h1 className="font-mono text-2xl font-bold text-[#D2CBFE] uppercase tracking-widest">
          NEW WORKSPACE
        </h1>
      </div>

      <StepIndicator current={step} total={3} />

      {/* Step 0 — Name & Domain */}
      {step === 0 && (
        <div className="space-y-8" style={{ animation: 'ws-card-fade-in 0.2s ease-out' }}>
          <div>
            <label className="font-mono text-sm text-[#888888] uppercase tracking-widest block mb-2">
              WORKSPACE NAME
            </label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Learn React, Quantum Physics Research"
              className="w-full bg-[#111111] border border-[#2a2a2a] font-mono text-base text-[#D2CBFE] px-5 py-4 outline-none focus:border-[#D2CBFE] transition-colors placeholder:text-[#333333]"
              maxLength={100}
            />
          </div>

          <div>
            <label className="font-mono text-sm text-[#888888] uppercase tracking-widest block mb-2">
              WHAT IS THIS ABOUT?
            </label>
            <textarea
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Describe the topic or subject in a sentence..."
              rows={3}
              className="w-full bg-[#111111] border border-[#2a2a2a] font-mono text-base text-[#D2CBFE] px-5 py-4 outline-none focus:border-[#D2CBFE] transition-colors placeholder:text-[#333333] resize-none"
              maxLength={200}
            />
          </div>

          <div>
            <label className="font-mono text-sm text-[#888888] uppercase tracking-widest block mb-3">
              TYPE
            </label>
            <div className="flex gap-4">
              {DOMAINS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDomain(d.value)}
                  className={[
                    'flex-1 py-4 font-mono text-sm uppercase tracking-widest border transition-colors duration-100',
                    domain === d.value
                      ? 'border-[#CDFC8A] text-[#CDFC8A] bg-[#CDFC8A]/5'
                      : 'border-[#2a2a2a] text-[#888888] hover:border-[#ffffff] hover:text-[#D2CBFE]',
                  ].join(' ')}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            disabled={!title || !subject || !domain}
            className="w-full py-4 font-mono text-base uppercase tracking-widest border border-[#CDFC8A] text-[#CDFC8A] hover:bg-[#CDFC8A] hover:text-[#0a0a0a] transition-colors duration-150 disabled:border-[#2a2a2a] disabled:text-[#444444] disabled:cursor-not-allowed shadow-[0_0_15px_rgba(205,252,138,0.15)] hover:shadow-[0_0_20px_rgba(205,252,138,0.3)]"
          >
            CONTINUE →
          </button>
        </div>
      )}

      {/* Step 1 — Intent */}
      {step === 1 && (
        <div className="space-y-4" style={{ animation: 'ws-card-fade-in 0.2s ease-out' }}>
          <p className="font-mono text-xs text-[#888888] uppercase tracking-widest mb-6">
            WHAT DO YOU WANT FROM THIS WORKSPACE?
          </p>

          {INTENTS.map(i => (
            <button
              key={i.value}
              onClick={() => setIntent(i.value)}
              className={[
                'w-full text-left p-4 border transition-colors duration-100',
                intent === i.value
                  ? 'border-[#CDFC8A] bg-[#CDFC8A]/5'
                  : 'border-[#2a2a2a] hover:border-[#ffffff]',
              ].join(' ')}
            >
              <div className={`font-mono text-sm font-bold uppercase tracking-wide mb-1 ${intent === i.value ? 'text-[#CDFC8A]' : 'text-[#D2CBFE]'}`}>
                {i.label}
              </div>
              <div className="font-mono text-xs text-[#888888]">{i.description}</div>
            </button>
          ))}

          {intent === 'custom' && (
            <textarea
              autoFocus
              value={intentNote}
              onChange={e => setIntentNote(e.target.value)}
              placeholder="Describe what you need..."
              rows={3}
              className="w-full bg-[#111111] border border-[#CDFC8A] font-mono text-sm text-[#D2CBFE] px-4 py-3 outline-none transition-colors placeholder:text-[#333333] resize-none mt-2"
              maxLength={300}
            />
          )}

          <button
            onClick={() => setStep(2)}
            disabled={!intent || (intent === 'custom' && !intentNote)}
            className="w-full py-3 font-mono text-sm uppercase tracking-widest border border-[#CDFC8A] text-[#CDFC8A] hover:bg-[#CDFC8A] hover:text-[#0a0a0a] transition-colors duration-150 disabled:border-[#2a2a2a] disabled:text-[#444444] disabled:cursor-not-allowed mt-2"
          >
            CONTINUE →
          </button>
        </div>
      )}

      {/* Step 2 — Review & Create */}
      {step === 2 && (
        <div className="space-y-6" style={{ animation: 'ws-card-fade-in 0.2s ease-out' }}>
          <p className="font-mono text-xs text-[#888888] uppercase tracking-widest">REVIEW</p>

          <div className="border border-[#2a2a2a] bg-[#022E21]">
            <div className="h-[3px] bg-[#3C183C]" />
            <div className="p-6 space-y-4">
              <div>
                <p className="font-mono text-[10px] text-[#444444] uppercase tracking-widest mb-1">NAME</p>
                <p className="font-mono text-lg font-bold text-[#D2CBFE] uppercase">{title}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-[#444444] uppercase tracking-widest mb-1">SUBJECT</p>
                <p className="font-mono text-sm text-[#888888]">{subject}</p>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="font-mono text-[10px] text-[#444444] uppercase tracking-widest mb-1">TYPE</p>
                  <p className="font-mono text-sm text-[#CDFC8A] uppercase">{domain}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-[#444444] uppercase tracking-widest mb-1">INTENT</p>
                  <p className="font-mono text-sm text-[#CDFC8A] uppercase">{intent?.replace(/_/g, ' ')}</p>
                </div>
              </div>
              {intentNote && (
                <div>
                  <p className="font-mono text-[10px] text-[#444444] uppercase tracking-widest mb-1">NOTE</p>
                  <p className="font-mono text-xs text-[#888888]">{intentNote}</p>
                </div>
              )}
              <div>
                <p className="font-mono text-[10px] text-[#444444] uppercase tracking-widest">
                  Resources can be added after creation (0/30)
                </p>
              </div>
            </div>
          </div>

          {error && (
            <p className="font-mono text-xs text-[#ff4444] border border-[#ff4444] px-4 py-2">{error}</p>
          )}

          <button
            onClick={create}
            disabled={loading}
            className="w-full py-3 font-mono text-sm uppercase tracking-widest border border-[#CDFC8A] text-[#CDFC8A] hover:bg-[#CDFC8A] hover:text-[#0a0a0a] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'CREATING...' : 'CREATE WORKSPACE →'}
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
