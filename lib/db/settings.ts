import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'
import type { settingsPatchSchema } from '@/lib/validation/schemas'

type Patch = z.infer<typeof settingsPatchSchema>

async function replaceRows(db: SupabaseClient, table: string, userId: string, rows: Record<string, unknown>[] | undefined) {
  if (rows === undefined) return
  const { error: delError } = await db.from(table).delete().eq('user_id', userId)
  if (delError) {
    console.error(`Error deleting from ${table}:`, delError)
    throw delError
  }
  if (rows.length) {
    const { error: insError } = await db.from(table).insert(rows.map((r) => ({ ...r, user_id: userId })))
    if (insError) {
      console.error(`Error inserting into ${table}:`, insError)
      throw insError
    }
  }
}

/** `db` must be the user-scoped client so RLS applies. */
export async function applySettingsPatch(db: SupabaseClient, userId: string, patch: Patch) {
  const { topics, keywords, ignoreRules, priorityPeople, ...scalar } = patch
  const scalars = Object.fromEntries(Object.entries(scalar).filter(([, v]) => v !== undefined))
  if (Object.keys(scalars).length) {
    const { error: upsertError } = await db
      .from('attention_settings')
      .upsert({ user_id: userId, ...scalars, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (upsertError) {
      console.error('Error upserting attention_settings:', upsertError)
      throw upsertError
    }
  }
  await replaceRows(db, 'user_topics', userId, topics)
  await replaceRows(db, 'user_keywords', userId, keywords)
  await replaceRows(db, 'user_ignore_rules', userId, ignoreRules)
  await replaceRows(db, 'priority_people', userId, priorityPeople)
}
