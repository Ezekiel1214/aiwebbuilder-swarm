import { createServiceClient } from './auth.ts'

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60 // seconds
const RATE_LIMIT_MAX_REQUESTS = 30 // requests per window

// Check rate limit for a user
export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const supabase = createServiceClient()
  const key = `ai_proxy:${userId}`
  
  try {
    const { data: allowed, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_window_seconds: RATE_LIMIT_WINDOW,
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
    })
    
    if (error) {
      console.error('Rate limit check error:', error)
      // Fail open if we can't check rate limit
      return { allowed: true }
    }
    
    if (!allowed) {
      return { allowed: false, retryAfter: RATE_LIMIT_WINDOW }
    }
    
    return { allowed: true }
  } catch (err) {
    console.error('Rate limit error:', err)
    // Fail open
    return { allowed: true }
  }
}

// Alternative: Upstash Redis implementation (recommended for production)
// Uncomment and use this instead of the Postgres implementation above
/*
import { Redis } from 'https://deno.land/x/upstash_redis@v1.22.0/mod.ts'

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!,
})

export async function checkRateLimitRedis(userId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = `rate_limit:ai_proxy:${userId}`
  const window = 60 // seconds
  const limit = 30
  
  const now = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(now / window) * window
  const windowKey = `${key}:${windowStart}`
  
  const current = await redis.incr(windowKey)
  
  if (current === 1) {
    // First request in this window, set expiry
    await redis.expire(windowKey, window)
  }
  
  if (current > limit) {
    return { allowed: false, retryAfter: window - (now - windowStart) }
  }
  
  return { allowed: true }
}
*/
