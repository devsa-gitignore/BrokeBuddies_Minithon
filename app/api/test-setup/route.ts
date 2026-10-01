import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateWebhookToken, hashToken, tokenHint } from '@/lib/security/token'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const admin = createAdminClient()
  
  // 1. Get or create a test user
  let { data: users, error: userErr } = await admin.auth.admin.listUsers()
  if (userErr) return NextResponse.json({ error: 'Failed to list users', details: userErr }, { status: 500 })
  
  let userId = users?.users[0]?.id

  if (!userId) {
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: 'test@example.com',
      password: 'password123',
      email_confirm: true
    })
    if (createErr) return NextResponse.json({ error: 'Failed to create user', details: createErr }, { status: 500 })
    userId = newUser.user.id
    
    // Create profile
    await admin.from('profiles').insert({ id: userId })
    // Create attention settings
    await admin.from('attention_settings').insert({ user_id: userId })
  }

  // 2. Create a webhook connection for this user
  const token = generateWebhookToken()
  const { data: conn, error: connErr } = await admin.from('source_connections').insert({
    user_id: userId,
    source_type: 'phone_notification',
    name: 'My Test Phone',
    status: 'live',
    enabled: true,
    token_hash: hashToken(token),
    token_hint: tokenHint(token),
    payload_mapping: {
      title: "title",
      text: "text",
      appName: "appName"
    }
  }).select().single()

  if (connErr) return NextResponse.json({ error: 'Failed to create connection', details: connErr }, { status: 500 })

  // 3. Construct the Webhook URL
  const baseUrl = 'https://long-cooks-listen.loca.lt'
  const webhookUrl = `${baseUrl}/api/ingest/${token}`

  return NextResponse.json({
    message: 'Setup successful!',
    userId,
    webhookUrl,
    instructions: `Copy the webhookUrl above and use it as the POST destination for your test notification.`
  })
}
