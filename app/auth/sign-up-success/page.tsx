import Link from 'next/link'

export default function SignUpSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link. Confirm your address, then sign in to finish setup.
        </p>
        <Link href="/auth/login" className="inline-block text-sm underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    </main>
  )
}
