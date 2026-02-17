-- Add AI budget tracking functions and triggers

-- Function to calculate total AI cost for a user
CREATE OR REPLACE FUNCTION get_user_ai_cost(user_uuid UUID, since TIMESTAMPTZ DEFAULT NULL)
RETURNS NUMERIC AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(cost_usd) 
         FROM ai_usage 
         WHERE user_id = user_uuid 
         AND status = 'ok'
         AND (since IS NULL OR created_at >= since)),
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate total AI cost for a project
CREATE OR REPLACE FUNCTION get_project_ai_cost(project_uuid UUID, since TIMESTAMPTZ DEFAULT NULL)
RETURNS NUMERIC AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(cost_usd) 
         FROM ai_usage 
         WHERE project_id = project_uuid 
         AND status = 'ok'
         AND (since IS NULL OR created_at >= since)),
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_ai_cost(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_ai_cost(UUID, TIMESTAMPTZ) TO authenticated;
