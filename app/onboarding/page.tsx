import { redirect } from 'next/navigation'
import { OnboardingForm } from '@/components/onboarding/onboarding-form'
import { createClient } from '@/lib/supabase/server'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle()
  if (profile?.onboarding_completed) redirect('/dashboard')
  return <OnboardingForm />
}
