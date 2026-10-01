'use client'

import Link from 'next/link'
import type { WorkspaceRow } from '@/types/workspace'

const DOMAIN_COLORS: Record<string, string> = {
  research: '#CDFC8A',
  study:    '#D2CBFE',
  code:     '#888888',
}

const STATUS_LABELS: Record<string, string> = {
  pending:    'NOT YET PROCESSED',
  processing: 'PROCESSING...',
  ready:      'READY',
  failed:     'FAILED',
}

const STATUS_COLORS: Record<string, string> = {
  pending:    '#444444',
  processing: '#CDFC8A',
  ready:      '#CDFC8A',
  failed:     '#ff4444',
}

interface WorkspaceCardProps {
  workspace: WorkspaceRow
  index: number
}

export function WorkspaceCard({ workspace, index }: WorkspaceCardProps) {
  const domainColor = DOMAIN_COLORS[workspace.domain] ?? '#888888'
  const statusLabel = STATUS_LABELS[workspace.org_status] ?? workspace.org_status.toUpperCase()
  const statusColor = STATUS_COLORS[workspace.org_status] ?? '#888888'
  const createdAt = new Date(workspace.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <Link
      href={`/workspaces/${workspace.id}`}
      className="group block"
      style={{
        animationDelay: `${500 + index * 80}ms`,
        animation: 'ws-card-fade-in 0.3s ease-out both',
      }}
    >
      <div className="
        relative border border-[#2a2a2a] bg-[#022E21]
        transition-colors duration-100
        group-hover:border-[#ffffff]
        overflow-hidden
      ">
        {/* Dark purple top accent */}
        <div className="h-[3px] w-full bg-[#3C183C]" />

        <div className="p-6">
          {/* Domain + status row */}
          <div className="flex items-center justify-between mb-4">
            <span
              className="font-mono text-xs uppercase tracking-widest border px-3 py-1"
              style={{ color: domainColor, borderColor: domainColor }}
            >
              {workspace.domain}
            </span>
            <span
              className="font-mono text-xs uppercase tracking-widest"
              style={{ color: statusColor }}
            >
              {workspace.org_status === 'processing' && (
                <span className="mr-2 animate-spin inline-block">◐</span>
              )}
              {statusLabel}
            </span>
          </div>

          {/* Title */}
          <h2 className="font-mono font-bold text-2xl text-[#D2CBFE] uppercase tracking-wide leading-tight mb-2 group-hover:text-white transition-colors duration-100">
            {workspace.title}
          </h2>
          <p className="font-mono text-sm text-[#888888] mb-6 truncate">{workspace.subject}</p>

          {/* Resource count bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-[#444444] uppercase tracking-widest">RESOURCES</span>
              <span className="font-mono text-xs text-[#888888]">{workspace.resource_count}/30</span>
            </div>
            <div className="h-[3px] bg-[#1a1a1a] w-full">
              <div
                className="h-full bg-[#3C183C] transition-all duration-300"
                style={{ width: `${(workspace.resource_count / 30) * 100}%` }}
              />
            </div>
          </div>

          <p className="font-mono text-xs text-[#444444]">Created {createdAt}</p>
        </div>
      </div>

    </Link>
  )
}
