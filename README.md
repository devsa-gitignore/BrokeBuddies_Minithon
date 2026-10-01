# Attention Inbox

A personal information triage app. Everything that arrives (phone notifications, calendar, email, RSS, and clearly labeled mock sources) is normalized, scored, and sorted into four categories: **Urgent**, **People**, **Summaries**, **For You**. Interruptions are planned against quiet hours, focus mode, and a daily interruption budget; everything else waits for a digest.

## Stack

- Next.js App Router, TypeScript, Tailwind, shadcn/ui
- Supabase (Postgres, Auth, Realtime) with Row Level Security on every table
- Zod for validation, Vitest for tests

## Setup

1. Connect the Supabase integration (provides `NEXT_PUBLIC_SUPABASE_URL`, anon key, and `SUPABASE_SERVICE_ROLE_KEY`).
2. The schema lives in the `init_attention_schema` migration. It creates all tables, RLS policies, the `handle_new_user` trigger, and the webhook rate-limit function.
3. Sign up, confirm your email, then complete onboarding (topics, keywords, priority people, quiet hours).
4. Run `pnpm test` for the unit tests.

## How it works

Ingest path: `adapter -> normalizer -> time extraction -> categorizer -> scoring -> clustering -> delivery plan -> items table`.

| Stage | File | Notes |
| --- | --- | --- |
| Adapters | `lib/adapters/phoneNotification.ts` | Generic JSON; per-connection `payload_mapping` overrides field paths |
| Normalizer | `lib/normalizer.ts` | Validation, stable dedupe key, phone items stripped to sender-only |
| Time extraction | `lib/timeExtraction.ts` | Deterministic and conservative; returns no signal rather than guessing |
| Scoring | `lib/scoring.ts` | Relevance, urgency, sender, novelty, context, with a stored breakdown |
| Clustering | `lib/clustering.ts` | Token overlap or explicit hints; breaking needs a topic match plus several independent publishers in a window |
| Attention | `lib/attention.ts` | Interrupt vs digest, quiet hours, focus, budget, break-through rules |

## Sources

- **Phone notifications**: create a connection on the Sources page to get a private webhook URL (`/api/ingest/<token>`). Tokens are shown once and stored only as a hash. Requests are rate limited per connection.
- **RSS**: refreshed through `/api/rss/refresh`.
- **Mock sources**: seeded through `/api/seed`. Mock items are flagged `is_mock` and labeled in the UI.
- Gmail and Calendar show as not configured until credentials exist. They are never faked as live.

## Privacy and security

- RLS scopes every row to `auth.uid()`. Clients can only write `is_read` and `is_dismissed` on items; scoring fields and token hashes are not writable or readable from the browser.
- Phone notification bodies are discarded at normalization.
- Webhook tokens are high-entropy, hashed, and rate limited.

## Known limitations

- Notification2Webhook has no payload schema this app depends on, so mapping is best-effort until you set a `payload_mapping`.
- Cluster summaries are only generated when a model is available; otherwise they show as unavailable.
- Quiet hours and digest times are evaluated in the user's configured timezone.
