'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/dashboard', label: 'Feeds' },
  { href: '/sources', label: 'Sources' },
  { href: '/settings', label: 'Settings' },
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
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <nav aria-label="Primary" className="flex items-center gap-1">
          <span className="mr-3 text-sm font-semibold">Attention</span>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground',
                pathname === l.href && 'bg-muted text-foreground',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </header>
  )
}
