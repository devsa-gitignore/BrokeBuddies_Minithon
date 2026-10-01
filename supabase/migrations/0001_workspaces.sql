-- ============================================================
-- WORKSPACES MIGRATION
-- Adds all workspace tables. Zero modifications to existing tables.
-- ============================================================

-- ----------------------------------------
-- WORKSPACES
-- ----------------------------------------
CREATE TABLE workspaces (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title          TEXT NOT NULL,
  subject        TEXT NOT NULL,
  intent         TEXT NOT NULL CHECK (intent IN ('teach_me','study_plan','research_deep','code_guide','custom')),
  intent_note    TEXT,
  domain         TEXT NOT NULL CHECK (domain IN ('research','code','study')),
  resource_count INTEGER DEFAULT 0 NOT NULL,
  org_status     TEXT DEFAULT 'pending' NOT NULL CHECK (org_status IN ('pending','processing','ready','failed')),
  org_version    INTEGER DEFAULT 0 NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_owner" ON workspaces FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_workspaces_user ON workspaces(user_id, created_at DESC);

-- ----------------------------------------
-- WORKSPACE RESOURCES
-- ----------------------------------------
CREATE TABLE workspace_resources (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id   UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url            TEXT,
  resource_type  TEXT NOT NULL CHECK (resource_type IN ('youtube','reddit','article','pdf','github','other_url')),
  title          TEXT,
  extracted_text TEXT,
  extracted_meta JSONB DEFAULT '{}'::jsonb NOT NULL,
  extract_status TEXT DEFAULT 'pending' NOT NULL CHECK (extract_status IN ('pending','done','failed')),
  extract_error  TEXT,
  position       INTEGER NOT NULL DEFAULT 0,
  added_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
ALTER TABLE workspace_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_resource_owner" ON workspace_resources FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_ws_resources_workspace ON workspace_resources(workspace_id, position);

-- DB-level 30 resource cap + auto-position
CREATE OR REPLACE FUNCTION ws_enforce_resource_limit()
RETURNS TRIGGER AS $$
DECLARE
  cur_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cur_count
    FROM workspace_resources
   WHERE workspace_id = NEW.workspace_id;
  IF cur_count >= 30 THEN
    RAISE EXCEPTION 'workspace_resource_limit_exceeded'
      USING DETAIL = 'A workspace may have at most 30 resources.';
  END IF;
  NEW.position := cur_count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ws_resource_limit
  BEFORE INSERT ON workspace_resources
  FOR EACH ROW EXECUTE FUNCTION ws_enforce_resource_limit();

-- Keep resource_count in sync
CREATE OR REPLACE FUNCTION ws_sync_resource_count()
RETURNS TRIGGER AS $$
DECLARE
  ws_id UUID;
BEGIN
  ws_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  UPDATE workspaces
     SET resource_count = (SELECT COUNT(*) FROM workspace_resources WHERE workspace_id = ws_id),
         updated_at = NOW()
   WHERE id = ws_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ws_sync_count
  AFTER INSERT OR DELETE ON workspace_resources
  FOR EACH STATEMENT EXECUTE FUNCTION ws_sync_resource_count();

-- ----------------------------------------
-- WORKSPACE ORGANIZATION (one row per workspace, upserted on re-process)
-- ----------------------------------------
CREATE TABLE workspace_organization (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
  version         INTEGER DEFAULT 1 NOT NULL,
  sections        JSONB NOT NULL DEFAULT '[]'::jsonb,
  synthesis       JSONB NOT NULL DEFAULT '{}'::jsonb,
  diagram_mermaid TEXT,
  diagram_title   TEXT,
  diagram_type    TEXT,
  source_check    JSONB DEFAULT '[]'::jsonb NOT NULL,
  model_used      TEXT,
  generated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
ALTER TABLE workspace_organization ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_org_owner" ON workspace_organization FOR ALL
  USING (EXISTS (
    SELECT 1 FROM workspaces w
     WHERE w.id = workspace_organization.workspace_id
       AND w.user_id = auth.uid()
  ));

-- ----------------------------------------
-- WORKSPACE NOTES (one row per workspace)
-- ----------------------------------------
CREATE TABLE workspace_notes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content      TEXT DEFAULT '' NOT NULL,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
ALTER TABLE workspace_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_notes_owner" ON workspace_notes FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------
-- WORKSPACE CHATS (message history per workspace)
-- ----------------------------------------
CREATE TABLE workspace_chats (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content      TEXT NOT NULL,
  model_used   TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
ALTER TABLE workspace_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_chats_owner" ON workspace_chats FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_ws_chats ON workspace_chats(workspace_id, created_at ASC);
