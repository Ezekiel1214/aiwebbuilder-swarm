-- Enable RLS
alter table if exists projects enable row level security;
alter table if exists project_members enable row level security;
alter table if exists project_events enable row level security;
alter table if exists project_projections enable row level security;
alter table if exists ai_usage enable row level security;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project members table
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- Project events table (append-only event log)
CREATE TABLE IF NOT EXISTS project_events (
    id BIGSERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seq BIGINT NOT NULL,
    type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, seq)
);

-- Project projections table (materialized read model)
CREATE TABLE IF NOT EXISTS project_projections (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    head_seq BIGINT NOT NULL DEFAULT 0,
    snapshot JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI usage ledger table
CREATE TABLE IF NOT EXISTS ai_usage (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('ok', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_events_project ON project_events(project_id);
CREATE INDEX IF NOT EXISTS idx_project_events_seq ON project_events(project_id, seq);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_project ON ai_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects" ON projects
    FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can view projects they are members of" ON projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = projects.id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create projects" ON projects
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their projects" ON projects
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their projects" ON projects
    FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for project_members
CREATE POLICY "Users can view members of their projects" ON project_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE id = project_members.project_id AND owner_id = auth.uid()
        ) OR user_id = auth.uid()
    );

CREATE POLICY "Project owners can manage members" ON project_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE id = project_members.project_id AND owner_id = auth.uid()
        )
    );

-- RLS Policies for project_events (append-only, no updates/deletes)
CREATE POLICY "Users can view events of their projects" ON project_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE id = project_events.project_id AND owner_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = project_events.project_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can insert events" ON project_events
    FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- RLS Policies for project_projections
CREATE POLICY "Users can view projections of their projects" ON project_projections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE id = project_projections.project_id AND owner_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = project_projections.project_id AND user_id = auth.uid()
        )
    );

-- RLS Policies for ai_usage (users can only view their own usage)
CREATE POLICY "Users can view their own AI usage" ON ai_usage
    FOR SELECT USING (user_id = auth.uid());

-- No insert/update/delete policies for ai_usage - only server-side via service role
