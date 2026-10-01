'use client'

import { useEffect } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'

// Revalidates every SWR key when the user's items or delivery_events change,
// so new ingests and planner decisions appear without waiting for the poll interval.
export function RealtimeSync() {
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | undefined
    let debounce: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const scheduleRefresh = () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        void mutate(() => true)
      }, 750)
    }

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      channel = supabase
        .channel(`attention-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `user_id=eq.${user.id}` }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_events', filter: `user_id=eq.${user.id}` }, scheduleRefresh)
        .subscribe()
    })()

    return () => {
      cancelled = true
      clearTimeout(debounce)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])

  return null
}
