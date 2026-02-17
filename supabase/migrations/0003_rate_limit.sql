-- Rate limiting table (for distributed rate limiting)
-- Note: In production, consider using Upstash Redis instead for better scalability

CREATE TABLE IF NOT EXISTS rate_limits (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    window_start TIMESTAMPTZ NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_window_seconds INTEGER,
    p_max_requests INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_count INTEGER;
BEGIN
    v_window_start := date_trunc('second', now()) - interval '1 second' * (EXTRACT(SECOND FROM now())::INTEGER % p_window_seconds);
    
    -- Try to get existing counter
    SELECT count INTO v_count
    FROM rate_limits
    WHERE key = p_key AND window_start = v_window_start;
    
    IF v_count IS NULL THEN
        -- New window
        INSERT INTO rate_limits (key, window_start, count)
        VALUES (p_key, v_window_start, 1)
        ON CONFLICT (key) DO UPDATE
        SET window_start = v_window_start, count = 1, updated_at = now()
        WHERE rate_limits.window_start < v_window_start;
        RETURN true;
    ELSIF v_count >= p_max_requests THEN
        -- Rate limit exceeded
        RETURN false;
    ELSE
        -- Increment counter
        UPDATE rate_limits
        SET count = count + 1, updated_at = now()
        WHERE key = p_key AND window_start = v_window_start;
        RETURN true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current rate limit status
CREATE OR REPLACE FUNCTION get_rate_limit_status(
    p_key TEXT,
    p_window_seconds INTEGER
)
RETURNS TABLE(count INTEGER, limit_val INTEGER, remaining INTEGER, reset_at TIMESTAMPTZ) AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_count INTEGER;
BEGIN
    v_window_start := date_trunc('second', now()) - interval '1 second' * (EXTRACT(SECOND FROM now())::INTEGER % p_window_seconds);
    
    SELECT COALESCE(rl.count, 0) INTO v_count
    FROM rate_limits rl
    WHERE rl.key = p_key AND rl.window_start = v_window_start;
    
    RETURN QUERY
    SELECT 
        v_count,
        p_window_seconds,
        GREATEST(0, p_window_seconds - v_count),
        v_window_start + interval '1 second' * p_window_seconds;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rate_limit_status(TEXT, INTEGER) TO authenticated;

-- Cleanup old rate limit entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_rate_limits(max_age_hours INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM rate_limits
    WHERE window_start < now() - interval '1 hour' * max_age_hours;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
