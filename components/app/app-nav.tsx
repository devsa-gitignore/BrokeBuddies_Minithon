'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Target, Zap, Settings, LogOut, LayoutGrid } from 'lucide-react'

const LINKS = [
  { href: '/dashboard', label: 'ATTENTION', icon: Target },
  { href: '/highlights', label: 'HIGHLIGHTS', icon: Zap },
  { href: '/workspaces', label: 'WORKSPACES', icon: LayoutGrid },
  { href: '/settings', label: 'SETTINGS', icon: Settings },
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
    <header className="sticky top-0 z-50 border-b-4 border-white/10 bg-neo-black text-white font-sans">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Brand */}
        <span className="font-pixel text-xl text-neo-lime">SYS<span className="text-white">_CORE</span></span>

        {/* Nav */}
        <nav aria-label="Primary" className="hidden md:flex items-center gap-6">
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.href !== '/dashboard' && pathname.startsWith(l.href))
            const Icon = l.icon
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 font-pixel text-sm uppercase transition-colors px-3 py-2 border-b-4 ${
                  active
                    ? 'border-neo-lime text-neo-lime'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Icon className="w-4 h-4" />
                {l.label}
              </Link>
            )
          })}
        </nav>

        {/* Mobile Nav (simplified for spacing, real implementation might use a drawer) */}
        <nav aria-label="Primary Mobile" className="flex md:hidden items-center gap-4">
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.href !== '/dashboard' && pathname.startsWith(l.href))
            const Icon = l.icon
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`transition-colors ${
                  active ? 'text-neo-lime' : 'text-white/50 hover:text-white'
                }`}
              >
                <Icon className="w-6 h-6" />
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="flex items-center gap-2 font-pixel text-xs text-white/50 hover:text-white transition-colors uppercase border-2 border-transparent hover:border-white/20 px-3 py-1.5"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">TERMINATE</span>
        </button>
      </div>
    </header>
  )
}
