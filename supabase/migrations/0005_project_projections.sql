-- Migration 0005: Ensure project_projections table has correct schema and policies
-- Note: Table was created in 0001_init.sql, this ensures consistency with requirements

-- Ensure all required columns exist with correct defaults
ALTER TABLE project_projections 
    ALTER COLUMN head_seq SET DEFAULT 0,
    ALTER COLUMN snapshot SET DEFAULT '{}'::jsonb,
    ALTER COLUMN updated_at SET DEFAULT now();

-- Ensure snapshot is NOT NULL
ALTER TABLE project_projections 
    ALTER COLUMN snapshot SET NOT NULL;

-- Add index on updated_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_project_projections_updated 
    ON project_projections(updated_at);

-- Update RLS policies for project_projections
-- SELECT: allowed to project members/owners
DROP POLICY IF EXISTS "Members can view projections" ON project_projections;
CREATE POLICY "Members can view projections" ON project_projections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members 
            WHERE project_id = project_projections.project_id 
            AND user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM projects 
            WHERE id = project_projections.project_id 
            AND owner_id = auth.uid()
        )
    );

-- UPDATE: disallow from clients (only Edge Function via service role should update)
DROP POLICY IF EXISTS "No client updates on projections" ON project_projections;
CREATE POLICY "No client updates on projections" ON project_projections
    FOR UPDATE USING (false);

-- INSERT: disallow from clients (seeded via server path)
DROP POLICY IF EXISTS "No client inserts on projections" ON project_projections;
CREATE POLICY "No client inserts on projections" ON project_projections
    FOR INSERT WITH CHECK (false);

-- Grant SELECT permission only to authenticated users
GRANT SELECT ON project_projections TO authenticated;

-- Create helper function to apply event and return new snapshot
-- This runs with SECURITY DEFINER so it can update projections
CREATE OR REPLACE FUNCTION apply_project_event(
    p_project_id UUID,
    p_actor_id UUID,
    p_type TEXT,
    p_payload JSONB
)
RETURNS TABLE(seq BIGINT, snapshot JSONB) AS $$
DECLARE
    v_head_seq BIGINT;
    v_current_snapshot JSONB;
    v_next_seq BIGINT;
    v_new_snapshot JSONB;
BEGIN
    -- Lock the projection row for update (create if missing)
    SELECT head_seq, snapshot 
    INTO v_head_seq, v_current_snapshot
    FROM project_projections
    WHERE project_id = p_project_id
    FOR UPDATE;
    
    -- If no projection exists, create initial state
    IF v_head_seq IS NULL THEN
        v_head_seq := 0;
        v_current_snapshot := '{}'::jsonb;
        
        INSERT INTO project_projections (project_id, head_seq, snapshot)
        VALUES (p_project_id, v_head_seq, v_current_snapshot);
    END IF;
    
    -- Calculate next sequence
    v_next_seq := v_head_seq + 1;
    
    -- Apply event to snapshot (simple reducer logic inline)
    CASE p_type
        WHEN 'project.rename' THEN
            v_new_snapshot := jsonb_set(
                v_current_snapshot,
                '{name}',
                to_jsonb(p_payload->>'name')
            );
        ELSE
            -- Unknown event type - raise exception
            RAISE EXCEPTION 'Unknown event type: %', p_type;
    END CASE;
    
    -- Insert the event
    INSERT INTO project_events (project_id, actor_id, seq, type, payload)
    VALUES (p_project_id, p_actor_id, v_next_seq, p_type, p_payload);
    
    -- Update projection
    UPDATE project_projections
    SET head_seq = v_next_seq,
        snapshot = v_new_snapshot,
        updated_at = now()
    WHERE project_id = p_project_id;
    
    -- Return result
    RETURN QUERY SELECT v_next_seq, v_new_snapshot;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION apply_project_event(UUID, UUID, TEXT, JSONB) TO authenticated;
