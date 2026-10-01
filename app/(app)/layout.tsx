import { redirect } from 'next/navigation'
import { AppNav } from '@/components/app/app-nav'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle()
  if (!profile?.onboarding_completed) redirect('/onboarding')

  return (
    <>
      <AppNav />
      <main>{children}</main>
    </>
  )
}
