-- Migration 0004: Ensure project_events table has correct schema and indexes
-- Note: Table was created in 0001_init.sql, this adds missing constraints/indexes

-- Rename created_at to inserted_at if needed (idempotent)
DO $$
BEGIN
    -- Check if created_at column exists and inserted_at doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_events' 
        AND column_name = 'created_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_events' 
        AND column_name = 'inserted_at'
    ) THEN
        ALTER TABLE project_events RENAME COLUMN created_at TO inserted_at;
    END IF;
    
    -- Add inserted_at if neither column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_events' 
        AND column_name IN ('created_at', 'inserted_at')
    ) THEN
        ALTER TABLE project_events ADD COLUMN inserted_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
END $$;

-- Ensure inserted_at has default value
ALTER TABLE project_events 
    ALTER COLUMN inserted_at SET DEFAULT now();

-- Drop and recreate indexes to ensure they match requirements
DROP INDEX IF EXISTS idx_project_events_inserted_at;
CREATE INDEX IF NOT EXISTS idx_project_events_inserted_at 
    ON project_events(project_id, inserted_at);

-- Ensure unique constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_project_events_project_seq'
    ) THEN
        CREATE UNIQUE INDEX idx_project_events_project_seq 
            ON project_events(project_id, seq);
    END IF;
END $$;

-- Update RLS policies for project_events
-- These complement the policies in 0001_init.sql

-- Ensure SELECT policy allows members/owners
DROP POLICY IF EXISTS "Members can view events" ON project_events;
CREATE POLICY "Members can view events" ON project_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = project_events.project_id 
            AND user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM projects 
            WHERE id = project_events.project_id 
            AND owner_id = auth.uid()
        )
    );

-- Ensure INSERT policy enforces actor_id = auth.uid()
DROP POLICY IF EXISTS "Events insert with actor check" ON project_events;
CREATE POLICY "Events insert with actor check" ON project_events
    FOR INSERT WITH CHECK (
        auth.uid() = actor_id
        AND (
            EXISTS (
                SELECT 1 FROM project_members 
                WHERE project_id = project_events.project_id 
                AND user_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM projects 
                WHERE id = project_events.project_id 
                AND owner_id = auth.uid()
            )
        )
    );

-- Explicitly disallow UPDATE and DELETE (append-only)
DROP POLICY IF EXISTS "No updates on events" ON project_events;
CREATE POLICY "No updates on events" ON project_events
    FOR UPDATE USING (false);

DROP POLICY IF EXISTS "No deletes on events" ON project_events;
CREATE POLICY "No deletes on events" ON project_events
    FOR DELETE USING (false);

-- Grant permissions
GRANT SELECT, INSERT ON project_events TO authenticated;
