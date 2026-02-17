import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { verifyAuth, createServiceClient } from '../_shared/auth.ts'
import { checkRateLimit } from '../_shared/rateLimit.ts'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

// Request schema validation
const ProposalSchema = z.object({
  type: z.literal('project.rename'),
  payload: z.object({
    name: z.string().min(1).max(200),
  }),
})

const RequestSchema = z.object({
  projectId: z.string().uuid(),
  baseSeq: z.number().int().min(0).optional(),
  proposal: ProposalSchema,
  idempotencyKey: z.string().optional(),
})

// Type for the apply_project_event function result
type ApplyEventResult = {
  seq: number
  snapshot: Record<string, unknown>
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  
  const corsHeaders = getCorsHeaders(req)
  
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Verify authentication
    const { userId, error: authError } = await verifyAuth(req)
    if (authError || !userId) {
      return new Response(
        JSON.stringify({ error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check rate limit
    const { allowed: rateAllowed, retryAfter } = await checkRateLimit(userId)
    if (!rateAllowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', retry_after: retryAfter }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter || 60),
          } 
        }
      )
    }
    
    // Parse and validate request body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const parseResult = RequestSchema.safeParse(body)
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const { projectId, baseSeq, proposal, idempotencyKey } = parseResult.data
    
    // Create service client
    const supabase = createServiceClient()
    
    // Verify user is member/owner of the project
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single()
    
    // Also check if user is owner
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()
    
    const isOwner = project?.owner_id === userId
    const isMember = membership && ['editor', 'viewer'].includes(membership.role)
    
    if (!isOwner && !isMember) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Not a project member' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check if user has permission to edit (not just view)
    if (membership?.role === 'viewer' && !isOwner) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Viewers cannot modify projects' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check optimistic concurrency if baseSeq provided
    if (baseSeq !== undefined) {
      const { data: projection, error: projectionError } = await supabase
        .from('project_projections')
        .select('head_seq')
        .eq('project_id', projectId)
        .single()
      
      if (projectionError && projectionError.code !== 'PGRST116') {
        // PGRST116 = not found, which is ok (will create)
        throw projectionError
      }
      
      const currentSeq = projection?.head_seq ?? 0
      if (currentSeq !== baseSeq) {
        return new Response(
          JSON.stringify({ 
            error: 'Conflict: Sequence number mismatch', 
            details: { expected: baseSeq, current: currentSeq }
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    // Apply the event atomically using the database function
    const { data: result, error: applyError } = await supabase.rpc(
      'apply_project_event',
      {
        p_project_id: projectId,
        p_actor_id: userId,
        p_type: proposal.type,
        p_payload: proposal.payload,
      }
    )
    
    if (applyError) {
      console.error('Failed to apply event:', applyError)
      return new Response(
        JSON.stringify({ error: 'Failed to apply event', details: applyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Parse result
    const applyResult = result as ApplyEventResult
    
    // Return success response
    return new Response(
      JSON.stringify({
        projectId,
        seq: applyResult.seq,
        snapshot: applyResult.snapshot,
        idempotencyKey: idempotencyKey || undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (err) {
    console.error('Unexpected error in mutate:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
