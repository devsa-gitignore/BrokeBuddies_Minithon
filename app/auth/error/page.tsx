import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">Sign-in link problem</h1>
        <p className="text-sm text-muted-foreground">The link is invalid or has expired. Try signing in again.</p>
        <Link href="/auth/login" className="inline-block text-sm underline underline-offset-4">
          Go to sign in
        </Link>
      </div>
    </main>
  )
}
