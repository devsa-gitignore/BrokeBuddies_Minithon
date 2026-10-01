'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export function AuthForm({ mode }: { mode: 'login' | 'sign-up' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const supabase = createClient()
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const msg = error.message.toLowerCase()
        setError(
          msg.includes('confirm')
            ? 'Please confirm your email before signing in.'
            : msg.includes('rate')
              ? 'Too many attempts. Try again shortly.'
              : 'Invalid email or password.',
        )
        setBusy(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
      return
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message.toLowerCase().includes('password') ? error.message : 'Could not create the account. Check the details and try again.')
      setBusy(false)
      return
    }
    router.push('/onboarding')
    router.refresh()
  }

  const isLogin = mode === 'login'
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-6">
        <div>
          <h1 className="text-xl font-semibold text-balance">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLogin ? 'Sign in to see what deserves your attention.' : 'Start filtering the noise.'}
          </p>
        </div>
        <label className="block space-y-1.5 text-sm">
          <span>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Please wait...' : isLogin ? 'Sign in' : 'Sign up'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? 'New here? ' : 'Already have an account? '}
          <Link className="text-foreground underline underline-offset-4" href={isLogin ? '/auth/sign-up' : '/auth/login'}>
            {isLogin ? 'Create an account' : 'Sign in'}
          </Link>
        </p>
      </form>
    </main>
  )
}
