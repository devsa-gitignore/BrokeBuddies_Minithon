'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import '@/components/workspaces/workspaces.css'
import { WorkspaceHeader } from '@/components/workspaces/WorkspaceHeader'
import { WorkspaceCard } from '@/components/workspaces/WorkspaceCard'
import type { WorkspaceDomain, WorkspaceRow } from '@/types/workspace'

interface WorkspaceListClientProps {
  initialWorkspaces: WorkspaceRow[]
}

type Filter = 'all' | WorkspaceDomain

// Ghost cards for empty state — show what workspaces will look like
function GhostCard({ domain, title, delay }: { domain: string; title: string; delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 0.8, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="border border-white bg-[#022E21]/50"
    >
      <div className="h-[3px] w-full bg-[#3C183C]/80" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-xs uppercase tracking-widest border border-white text-white px-2 py-1">
            {domain}
          </span>
        </div>
        <h2 className="font-mono font-bold text-xs text-white uppercase tracking-wide leading-tight mb-2">{title}</h2>
        <p className="font-mono text-sm text-white mb-6">— — — — — — — — — —</p>
        <div className="h-[2px] bg-white w-full mb-3">
          <div className="h-full bg-white w-0" />
        </div>
        <p className="font-mono text-xs text-white">0/30 resources</p>
      </div>
    </motion.div>
  )
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 gap-8"
    >
      {/* Dashed border box */}
      <motion.div 
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="border border-dashed border-[#2a2a2a] p-16 flex flex-col items-center gap-6 max-w-lg w-full bg-[#0d0d0d]"
      >
        {/* Pixelated grid icon */}
        <svg width="64" height="64" viewBox="0 0 48 48" fill="none" className="opacity-40">
          {[0,1,2,3].flatMap(row =>
            [0,1,2,3].map(col => {
              if ((row + col) % 3 === 0) return null
              return (
                <rect
                  key={`${row}-${col}`}
                  x={col * 13}
                  y={row * 13}
                  width="10"
                  height="10"
                  fill="#D2CBFE"
                />
              )
            })
          )}
        </svg>

        <div className="text-center">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#D2CBFE] mb-4">
            NO WORKSPACES YET
          </p>
          <p className="font-mono text-sm text-[#888888] leading-relaxed">
            Create your first workspace to start organizing<br />
            research, study materials, or code.
          </p>
        </div>

        <Link
          href="/workspaces/new"
          className="font-mono text-base uppercase tracking-widest px-8 py-3 border border-[#CDFC8A] text-[#CDFC8A] hover:bg-[#CDFC8A] hover:text-[#0a0a0a] transition-colors duration-150 shadow-[0_0_15px_rgba(205,252,138,0.15)] hover:shadow-[0_0_20px_rgba(205,252,138,0.3)]"
        >
          CREATE WORKSPACE →
        </Link>
      </motion.div>

      {/* Ghost cards */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
        <GhostCard domain="RESEARCH" title="EXAMPLE TOPIC" delay={0.4} />
        <GhostCard domain="STUDY" title="LEARN SOMETHING" delay={0.5} />
        <GhostCard domain="CODE" title="CODEBASE GUIDE" delay={0.6} />
      </div>
    </motion.div>
  )
}

export function WorkspaceListClient({ initialWorkspaces }: WorkspaceListClientProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = filter === 'all'
    ? initialWorkspaces
    : initialWorkspaces.filter(w => w.domain === filter)

  return (
    <div className="ws-full-viewport min-h-screen bg-[#0a0a0a] px-8 py-12">
      <div className="max-w-7xl mx-auto">
        <WorkspaceHeader
          count={initialWorkspaces.length}
          activeFilter={filter}
          onFilterChange={setFilter}
        />

      <div className="mt-12">
        {filtered.length === 0 && initialWorkspaces.length === 0 && <EmptyState />}

        {filtered.length === 0 && initialWorkspaces.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center py-20 gap-4"
          >
            <p className="font-mono text-[#888888] uppercase tracking-widest text-base">
              NO {filter.toUpperCase()} WORKSPACES
            </p>
            <button
              onClick={() => setFilter('all')}
              className="font-mono text-sm text-[#CDFC8A] uppercase tracking-widest hover:underline"
            >
              SHOW ALL →
            </button>
          </motion.div>
        )}

        {filtered.length > 0 && (
          <motion.div 
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.1 }
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered.map((ws, i) => (
              <motion.div 
                key={ws.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 }
                }}
              >
                <WorkspaceCard workspace={ws} index={i} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
      </div>
    </div>
  )
}
