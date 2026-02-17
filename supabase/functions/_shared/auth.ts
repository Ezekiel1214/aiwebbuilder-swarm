import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Service role client - ONLY use in Edge Functions, never expose to client
export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// Verify JWT token and return user info
export async function verifyAuth(req: Request): Promise<{ userId: string; error?: string }> {
  const authHeader = req.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: '', error: 'Missing or invalid authorization header' }
  }
  
  const token = authHeader.replace('Bearer ', '')
  
  try {
    const supabase = createServiceClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return { userId: '', error: 'Invalid token' }
    }
    
    return { userId: user.id }
  } catch (err) {
    return { userId: '', error: 'Authentication failed' }
  }
}
