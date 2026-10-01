-- Migration: extend schema for Phase 2 product restructure
-- Run this in Supabase SQL Editor after 0000_schema.sql

-- 1. Extend profiles with new onboarding fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS sources_used TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_version INTEGER DEFAULT 0;

-- 2. Extend attention_settings with new session + mode fields
ALTER TABLE attention_settings
  ADD COLUMN IF NOT EXISTS session_duration_minutes INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS attention_filter TEXT DEFAULT 'all', -- 'all' | 'important' | 'urgent_only'
  ADD COLUMN IF NOT EXISTS breaking_news_topics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS urgent_categories TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS job_search JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Fix feedback table: item_id was NOT NULL, but calibration feedback has no item
ALTER TABLE feedback
  ALTER COLUMN item_id DROP NOT NULL;

-- 4. Index for attention feed queries
CREATE INDEX IF NOT EXISTS idx_items_user_urgency ON items(user_id, urgency_score DESC, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_items_user_people ON items(user_id, category, people_kind, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_items_user_ts ON items(user_id, timestamp DESC);
