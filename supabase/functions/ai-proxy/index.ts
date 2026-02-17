import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { verifyAuth, createServiceClient } from '../_shared/auth.ts'
import { checkRateLimit } from '../_shared/rateLimit.ts'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

// Request schema validation
const RequestSchema = z.object({
  project_id: z.string().uuid().optional(),
  prompt: z.string().min(1).max(10000),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'groq', 'mistral']).default('openai'),
  model: z.string().default('gpt-4'),
})

// AI Provider cost configuration (per 1K tokens)
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
}

// Budget limits (USD)
const USER_DAILY_BUDGET = 10.00
const PROJECT_DAILY_BUDGET = 5.00

// Calculate cost for a request
function calculateCost(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = COST_PER_1K_TOKENS[model] || COST_PER_1K_TOKENS['gpt-4']
  const inputCost = (tokensIn / 1000) * pricing.input
  const outputCost = (tokensOut / 1000) * pricing.output
  return inputCost + outputCost
}

// Mock AI call - replace with actual API calls
async function callAIProvider(
  provider: string,
  model: string,
  prompt: string
): Promise<{ result: string; tokensIn: number; tokensOut: number }> {
  // TODO: Implement actual AI provider calls
  // For now, return mock response
  
  const mockResponse = `Mock AI response for: "${prompt.substring(0, 50)}..."`
  const tokensIn = Math.ceil(prompt.length / 4)
  const tokensOut = Math.ceil(mockResponse.length / 4)
  
  return {
    result: mockResponse,
    tokensIn,
    tokensOut,
  }
}

// Check budget before making AI call
async function checkBudget(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  projectId: string | undefined
): Promise<{ allowed: boolean; reason?: string }> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  // Check user daily budget
  const { data: userCost } = await supabase.rpc('get_user_ai_cost', {
    user_uuid: userId,
    since: today.toISOString(),
  })
  
  if (userCost && userCost >= USER_DAILY_BUDGET) {
    return { allowed: false, reason: 'User daily budget exceeded' }
  }
  
  // Check project budget if project_id provided
  if (projectId) {
    const { data: projectCost } = await supabase.rpc('get_project_ai_cost', {
      project_uuid: projectId,
      since: today.toISOString(),
    })
    
    if (projectCost && projectCost >= PROJECT_DAILY_BUDGET) {
      return { allowed: false, reason: 'Project daily budget exceeded' }
    }
  }
  
  return { allowed: true }
}

// Record AI usage in ledger
async function recordAIUsage(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  projectId: string | undefined,
  provider: string,
  model: string,
  tokensIn: number,
  tokensOut: number,
  costUsd: number,
  status: 'ok' | 'failed'
): Promise<void> {
  const { error } = await supabase.from('ai_usage').insert({
    user_id: userId,
    project_id: projectId || null,
    provider,
    model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: costUsd,
    status,
  })
  
  if (error) {
    console.error('Failed to record AI usage:', error)
  }
}

serve(async (req) => {
  // Handle CORS
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
    
    const { project_id, prompt, provider, model } = parseResult.data
    
    // Create service client
    const supabase = createServiceClient()
    
    // Check budget before proceeding
    const { allowed: budgetAllowed, reason: budgetReason } = await checkBudget(
      supabase,
      userId,
      project_id
    )
    
    if (!budgetAllowed) {
      // Record failed attempt
      await recordAIUsage(
        supabase,
        userId,
        project_id,
        provider,
        model,
        0,
        0,
        0,
        'failed'
      )
      
      return new Response(
        JSON.stringify({ error: budgetReason || 'Budget exceeded' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Call AI provider
    let aiResult: { result: string; tokensIn: number; tokensOut: number }
    try {
      aiResult = await callAIProvider(provider, model, prompt)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'AI provider error'
      
      // Record failed usage
      await recordAIUsage(
        supabase,
        userId,
        project_id,
        provider,
        model,
        0,
        0,
        0,
        'failed'
      )
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Calculate cost
    const costUsd = calculateCost(model, aiResult.tokensIn, aiResult.tokensOut)
    
    // Record successful usage
    await recordAIUsage(
      supabase,
      userId,
      project_id,
      provider,
      model,
      aiResult.tokensIn,
      aiResult.tokensOut,
      costUsd,
      'ok'
    )
    
    // Return success response
    return new Response(
      JSON.stringify({
        result: aiResult.result,
        usage: {
          tokens_in: aiResult.tokensIn,
          tokens_out: aiResult.tokensOut,
          cost_usd: costUsd,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
