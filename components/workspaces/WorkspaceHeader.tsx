'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface WorkspaceHeaderProps {
  count: number
  activeFilter: 'all' | 'research' | 'study' | 'code'
  onFilterChange: (f: 'all' | 'research' | 'study' | 'code') => void
}

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ▓#@%&$'
const TARGET = 'WORKSPACES'
const SCRAMBLE_DURATION = 480   // ms total
const LOCK_INTERVAL = SCRAMBLE_DURATION / TARGET.length  // ~48ms per char

function useScrambleText(target: string, duration: number) {
  const [display, setDisplay] = useState(() => target[0] + '▓'.repeat(target.length - 1))
  const [done, setDone] = useState(false)
  const lockedRef = useRef(0)

  useEffect(() => {
    let frame: ReturnType<typeof setTimeout>
    let lockFrame: ReturnType<typeof setTimeout>
    let startTime: number | null = null

    function scrambleTick() {
      const locked = lockedRef.current
      const chars = target.split('').map((ch, i) => {
        if (i < locked) return ch
        return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
      })
      setDisplay(chars.join(''))
      if (locked < target.length) {
        frame = setTimeout(scrambleTick, 40)
      }
    }

    function lockTick() {
      if (lockedRef.current < target.length) {
        lockedRef.current += 1
        lockFrame = setTimeout(lockTick, LOCK_INTERVAL)
      } else {
        setDisplay(target)
        setDone(true)
      }
    }

    scrambleTick()
    lockFrame = setTimeout(lockTick, LOCK_INTERVAL)

    return () => {
      clearTimeout(frame)
      clearTimeout(lockFrame)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { display, done }
}

function AnimatedButton({ href }: { href: string }) {
  const [borderProgress, setBorderProgress] = useState(0) // 0–4 sides
  const [textVisible, setTextVisible] = useState(false)

  useEffect(() => {
    const timers = [
      setTimeout(() => setBorderProgress(1), 0),
      setTimeout(() => setBorderProgress(2), 120),
      setTimeout(() => setBorderProgress(3), 240),
      setTimeout(() => setBorderProgress(4), 360),
      setTimeout(() => setTextVisible(true), 400),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  // Build border classes progressively
  const borderBottom = borderProgress >= 1 ? 'border-b border-b-[#CDFC8A]' : 'border-b border-b-transparent'
  const borderRight  = borderProgress >= 2 ? 'border-r border-r-[#CDFC8A]' : 'border-r border-r-transparent'
  const borderTop    = borderProgress >= 3 ? 'border-t border-t-[#CDFC8A]' : 'border-t border-t-transparent'
  const borderLeft   = borderProgress >= 4 ? 'border-l border-l-[#CDFC8A]' : 'border-l border-l-transparent'

  return (
    <Link
      href={href}
      className={[
        'relative px-4 py-2 font-mono text-sm uppercase tracking-widest',
        'transition-all duration-100',
        'hover:shadow-[0_0_14px_rgba(205,252,138,0.4)]',
        borderBottom, borderRight, borderTop, borderLeft,
        textVisible ? 'text-[#CDFC8A]' : 'text-transparent',
        'transition-colors duration-200',
      ].join(' ')}
      style={borderProgress === 4 ? { boxShadow: '0 0 8px rgba(205,252,138,0.25)' } : undefined}
    >
      [+ NEW WORKSPACE]
    </Link>
  )
}

const FILTERS = ['all', 'research', 'study', 'code'] as const

export function WorkspaceHeader({ count, activeFilter, onFilterChange }: WorkspaceHeaderProps) {
  const { display, done } = useScrambleText(TARGET, SCRAMBLE_DURATION)

  return (
    <div className="border-b border-[#2a2a2a] bg-[#0a0a0a] pb-4">
      {/* Top row */}
      <div className="flex items-center justify-between">
        {/* Title + count */}
        <div className="flex items-baseline gap-4">
          <h1 className="font-mono text-xs font-bold tracking-widest text-[#D2CBFE] uppercase select-none">
            <span>{display}</span>
            {done && (
              <span className="ml-1 animate-[blink_1s_step-end_infinite] text-[#D2CBFE]">_</span>
            )}
          </h1>
          <span
            className="font-mono text-base text-[#888888] transition-opacity duration-300"
            style={{ opacity: done ? 1 : 0, transitionDelay: '300ms' }}
          >
            {count} workspace{count !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Animated CTA button */}
        <AnimatedButton href="/workspaces/new" />
      </div>

      {/* Filter pills — stagger in after title settles */}
      <div
        className="mt-6 flex items-center gap-3 transition-opacity duration-300"
        style={{ opacity: done ? 1 : 0, transitionDelay: '450ms' }}
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={[
              'font-mono text-sm uppercase tracking-widest px-4 py-2 border transition-colors duration-100',
              activeFilter === f
                ? 'border-[#CDFC8A] text-[#CDFC8A]'
                : 'border-[#3C183C] text-[#888888] hover:border-[#ffffff] hover:text-[#D2CBFE]',
            ].join(' ')}
          >
            {f}
          </button>
        ))}
      </div>

    </div>
  )
}
