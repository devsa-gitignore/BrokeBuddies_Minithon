import Link from 'next/link'
import { redirect } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

const FEEDS = [
  ['Urgent', 'Deadlines and meetings you must act on, with the evidence.'],
  ['People', 'Priority contacts, repeat pingers and missed calls, grouped calmly.'],
  ['Summaries', 'Multi-source stories clustered, cited and checked for conflicts.'],
  ['For You', 'Discovery matched to your topics, never to outrage.'],
]

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Only what deserves your attention.</h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          Phone notifications, email, calendar and news go in. Four quiet feeds come out, each item with a plain-language reason it is there.
        </p>
        <div className="flex gap-3">
          <Link href="/auth/sign-up" className={buttonVariants({ size: 'lg' })}>
            Get started
          </Link>
          <Link href="/auth/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Sign in
          </Link>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {FEEDS.map(([t, d]) => (
          <li key={t} className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-medium">{t}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
