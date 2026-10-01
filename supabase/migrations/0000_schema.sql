-- Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-------------------------------------------------
-- PROFILES
-------------------------------------------------
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own profile" ON profiles FOR ALL USING (auth.uid() = id);

-------------------------------------------------
-- SOURCE CONNECTIONS
-------------------------------------------------
CREATE TABLE source_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    source_type TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'not_configured' NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    token_hash TEXT,
    token_hint TEXT,
    payload_mapping JSONB DEFAULT '{}'::jsonb NOT NULL,
    config JSONB DEFAULT '{}'::jsonb NOT NULL,
    last_received_at TIMESTAMP WITH TIME ZONE,
    events_received INTEGER DEFAULT 0 NOT NULL,
    last_error TEXT,
    last_error_category TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
ALTER TABLE source_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own connections" ON source_connections FOR ALL USING (auth.uid() = user_id);

-------------------------------------------------
-- CLUSTERS
-------------------------------------------------
CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    topic TEXT,
    signature TEXT,
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
    source_count INTEGER DEFAULT 1 NOT NULL,
    independent_source_count INTEGER DEFAULT 1 NOT NULL,
    has_conflict BOOLEAN DEFAULT FALSE NOT NULL,
    is_breaking BOOLEAN DEFAULT FALSE NOT NULL,
    importance_score INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own clusters" ON clusters FOR ALL USING (auth.uid() = user_id);

-------------------------------------------------
-- CLUSTER SUMMARIES
-------------------------------------------------
CREATE TABLE cluster_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    summary_json JSONB NOT NULL,
    model TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT cluster_summaries_cluster_id_key UNIQUE (cluster_id)
);
ALTER TABLE cluster_summaries ENABLE ROW LEVEL SECURITY;
-- Using cluster_id to join to clusters for RLS
CREATE POLICY "Users can manage summaries via clusters" ON cluster_summaries FOR ALL USING (
    EXISTS (SELECT 1 FROM clusters WHERE clusters.id = cluster_summaries.cluster_id AND clusters.user_id = auth.uid())
);

-------------------------------------------------
-- ITEMS
-------------------------------------------------
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    source_connection_id UUID REFERENCES source_connections(id) ON DELETE SET NULL,
    cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    external_id TEXT,
    source TEXT NOT NULL,
    source_type TEXT NOT NULL,
    sender TEXT,
    sender_identifier TEXT,
    timestamp TIMESTAMP WITH TIME ZONE,
    title TEXT,
    text TEXT,
    url TEXT,
    category TEXT DEFAULT 'skipped' NOT NULL,
    relevance_score INTEGER DEFAULT 0 NOT NULL,
    urgency_score INTEGER DEFAULT 0 NOT NULL,
    sender_weight INTEGER DEFAULT 0 NOT NULL,
    novelty_score INTEGER DEFAULT 0 NOT NULL,
    context_score INTEGER DEFAULT 0 NOT NULL,
    importance_score INTEGER DEFAULT 0 NOT NULL,
    score_breakdown JSONB DEFAULT '{}'::jsonb NOT NULL,
    why TEXT,
    act_by TIMESTAMP WITH TIME ZONE,
    act_by_confidence NUMERIC(3,2),
    urgency_evidence TEXT,
    is_overdue BOOLEAN DEFAULT FALSE NOT NULL,
    is_low_priority BOOLEAN DEFAULT FALSE NOT NULL,
    is_mock BOOLEAN DEFAULT FALSE NOT NULL,
    people_kind TEXT,
    notify_at TIMESTAMP WITH TIME ZONE,
    content_hash TEXT,
    dedupe_key TEXT NOT NULL,
    engagement JSONB DEFAULT '{}'::jsonb NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    processing_status TEXT DEFAULT 'pending' NOT NULL,
    processing_error TEXT,
    processing_version TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    is_dismissed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT items_user_dedupe_unique UNIQUE (user_id, dedupe_key)
);
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own items" ON items FOR ALL USING (auth.uid() = user_id);

-------------------------------------------------
-- PREFERENCES & SETTINGS
-------------------------------------------------
CREATE TABLE user_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    topic TEXT NOT NULL,
    weight INTEGER DEFAULT 1 NOT NULL
);
ALTER TABLE user_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage topics" ON user_topics FOR ALL USING (auth.uid() = user_id);

CREATE TABLE user_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    keyword TEXT NOT NULL,
    weight INTEGER DEFAULT 1 NOT NULL
);
ALTER TABLE user_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage keywords" ON user_keywords FOR ALL USING (auth.uid() = user_id);

CREATE TABLE user_ignore_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rule_type TEXT NOT NULL,
    rule_value TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL
);
ALTER TABLE user_ignore_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage ignore rules" ON user_ignore_rules FOR ALL USING (auth.uid() = user_id);

CREATE TABLE priority_people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    person_name TEXT NOT NULL,
    sender_identifier TEXT,
    source_type TEXT DEFAULT 'any' NOT NULL,
    priority_weight INTEGER DEFAULT 10 NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL
);
ALTER TABLE priority_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage priority people" ON priority_people FOR ALL USING (auth.uid() = user_id);

CREATE TABLE attention_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    timezone TEXT DEFAULT 'UTC' NOT NULL,
    quiet_start TEXT DEFAULT '22:00' NOT NULL,
    quiet_end TEXT DEFAULT '08:00' NOT NULL,
    digest_time TEXT DEFAULT '16:00' NOT NULL,
    meeting_lead_minutes INTEGER DEFAULT 15 NOT NULL,
    deadline_lead_hours INTEGER DEFAULT 2 NOT NULL,
    interruption_budget INTEGER DEFAULT 3 NOT NULL,
    current_mode TEXT DEFAULT 'normal' NOT NULL,
    focus_until TIMESTAMP WITH TIME ZONE
);
ALTER TABLE attention_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage settings" ON attention_settings FOR ALL USING (auth.uid() = user_id);

-------------------------------------------------
-- FEEDBACK & EVENTS
-------------------------------------------------
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage feedback" ON feedback FOR ALL USING (auth.uid() = user_id);

CREATE TABLE delivery_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'scheduled' NOT NULL,
    channel TEXT DEFAULT 'web' NOT NULL,
    reason TEXT,
    details JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT delivery_events_item_type_unique UNIQUE (item_id, event_type)
);
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage delivery events" ON delivery_events FOR ALL USING (auth.uid() = user_id);

CREATE TABLE ingestion_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    source_connection_id UUID REFERENCES source_connections(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    http_status INTEGER,
    error_category TEXT,
    details JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
ALTER TABLE ingestion_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage ingestion events" ON ingestion_events FOR ALL USING (auth.uid() = user_id);

-------------------------------------------------
-- INDEXES & RPCs
-------------------------------------------------
CREATE INDEX idx_items_user_category ON items(user_id, category);
CREATE INDEX idx_items_cluster ON items(cluster_id);
CREATE INDEX idx_delivery_scheduled ON delivery_events(user_id, status, scheduled_for);

-- RPC for Webhook rate limiting
CREATE OR REPLACE FUNCTION check_webhook_rate_limit(p_connection UUID, p_limit INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    event_count INTEGER;
BEGIN
    SELECT count(*) INTO event_count
    FROM ingestion_events
    WHERE source_connection_id = p_connection
      AND created_at >= NOW() - INTERVAL '1 minute';
      
    RETURN event_count < p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Stats: Category Breakdown
CREATE OR REPLACE FUNCTION count_items_by_category(uid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_object_agg(category, count) INTO result
    FROM (
        SELECT category, count(*) as count
        FROM items
        WHERE user_id = uid
        GROUP BY category
    ) sub;
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Stats: Source Distribution
CREATE OR REPLACE FUNCTION count_items_by_source(uid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_object_agg(source_type, count) INTO result
    FROM (
        SELECT source_type, count(*) as count
        FROM items
        WHERE user_id = uid
        GROUP BY source_type
    ) sub;
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
