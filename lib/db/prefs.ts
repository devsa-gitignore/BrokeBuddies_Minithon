import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS } from '@/lib/config'
import type { AttentionSettings, UserPrefs } from '@/types/domain'

export async function loadPrefs(db: SupabaseClient, userId: string): Promise<UserPrefs> {
  const [topics, keywords, rules, people, settings] = await Promise.all([
    db.from('user_topics').select('topic, weight').eq('user_id', userId).eq('enabled', true),
    db.from('user_keywords').select('keyword, weight').eq('user_id', userId).eq('enabled', true),
    db.from('user_ignore_rules').select('id, rule_type, rule_value, enabled').eq('user_id', userId),
    db
      .from('priority_people')
      .select('id, person_name, sender_identifier, source_type, priority_weight, enabled')
      .eq('user_id', userId),
    db.from('attention_settings').select('*').eq('user_id', userId).maybeSingle(),
  ])
  const s = (settings.data ?? {}) as Partial<AttentionSettings>
  return {
    topics: topics.data ?? [],
    keywords: keywords.data ?? [],
    ignoreRules: rules.data ?? [],
    priorityPeople: people.data ?? [],
    settings: {
      timezone: s.timezone ?? DEFAULT_SETTINGS.timezone,
      quiet_start: s.quiet_start ?? DEFAULT_SETTINGS.quiet_start,
      quiet_end: s.quiet_end ?? DEFAULT_SETTINGS.quiet_end,
      digest_time: s.digest_time ?? DEFAULT_SETTINGS.digest_time,
      meeting_lead_minutes: s.meeting_lead_minutes ?? DEFAULT_SETTINGS.meeting_lead_minutes,
      deadline_lead_hours: s.deadline_lead_hours ?? DEFAULT_SETTINGS.deadline_lead_hours,
      interruption_budget: s.interruption_budget ?? DEFAULT_SETTINGS.interruption_budget,
      current_mode: s.current_mode ?? 'normal',
      focus_until: s.focus_until ?? null,
    },
  }
}
