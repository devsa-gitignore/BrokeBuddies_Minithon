'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const LINKS = [
  { href: '/dashboard', label: 'Attention', icon: '🎯' },
  { href: '/highlights', label: 'Highlights', icon: '✦' },
  { href: '/workspaces', label: 'Workspaces', icon: '❖' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export function AppNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0d0d1a]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        {/* Brand */}
        <span className="text-sm font-semibold text-white/80 tracking-tight">Info</span>

        {/* Nav */}
        <nav aria-label="Primary" className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.href !== '/dashboard' && pathname.startsWith(l.href))
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <span className="text-xs">{l.icon}</span>
                {l.label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="rounded-lg px-3 py-1.5 text-sm text-white/30 hover:text-white/60 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
