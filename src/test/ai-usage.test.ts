import { describe, it, expect } from 'vitest'

// Cost calculation constants matching the Edge Function
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
}

// Calculate cost for a request (mirrors Edge Function logic)
function calculateCost(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = COST_PER_1K_TOKENS[model] || COST_PER_1K_TOKENS['gpt-4']
  const inputCost = (tokensIn / 1000) * pricing.input
  const outputCost = (tokensOut / 1000) * pricing.output
  return inputCost + outputCost
}

// Budget limits
const USER_DAILY_BUDGET = 10.00
const PROJECT_DAILY_BUDGET = 5.00

// Check if request is within budget
type UsageRecord = { cost_usd: number; status: 'ok' | 'failed' }

function checkBudget(
  userUsage: UsageRecord[],
  projectUsage: UsageRecord[] | null,
  requestCost: number
): { allowed: boolean; reason?: string } {
  const userTotal = userUsage
    .filter(u => u.status === 'ok')
    .reduce((sum, u) => sum + u.cost_usd, 0)
  
  if (userTotal + requestCost > USER_DAILY_BUDGET) {
    return { allowed: false, reason: 'User daily budget exceeded' }
  }
  
  if (projectUsage) {
    const projectTotal = projectUsage
      .filter(u => u.status === 'ok')
      .reduce((sum, u) => sum + u.cost_usd, 0)
    
    if (projectTotal + requestCost > PROJECT_DAILY_BUDGET) {
      return { allowed: false, reason: 'Project daily budget exceeded' }
    }
  }
  
  return { allowed: true }
}

describe('AI Usage Ledger', () => {
  describe('calculateCost', () => {
    it('should calculate cost correctly for GPT-4', () => {
      const cost = calculateCost('gpt-4', 1000, 500)
      // Input: (1000/1000) * 0.03 = 0.03
      // Output: (500/1000) * 0.06 = 0.03
      // Total: 0.06
      expect(cost).toBe(0.06)
    })

    it('should calculate cost correctly for GPT-3.5-turbo', () => {
      const cost = calculateCost('gpt-3.5-turbo', 2000, 1000)
      // Input: (2000/1000) * 0.0015 = 0.003
      // Output: (1000/1000) * 0.002 = 0.002
      // Total: 0.005
      expect(cost).toBe(0.005)
    })

    it('should calculate cost correctly for Claude 3 Opus', () => {
      const cost = calculateCost('claude-3-opus', 1000, 500)
      // Input: (1000/1000) * 0.015 = 0.015
      // Output: (500/1000) * 0.075 = 0.0375
      // Total: 0.0525
      expect(cost).toBeCloseTo(0.0525, 4)
    })

    it('should default to GPT-4 pricing for unknown models', () => {
      const cost = calculateCost('unknown-model', 1000, 500)
      expect(cost).toBe(0.06)
    })

    it('should handle zero tokens', () => {
      const cost = calculateCost('gpt-4', 0, 0)
      expect(cost).toBe(0)
    })
  })

  describe('checkBudget', () => {
    it('should allow request when under budget', () => {
      const userUsage: UsageRecord[] = [
        { cost_usd: 1.0, status: 'ok' },
        { cost_usd: 2.0, status: 'ok' },
      ]
      const result = checkBudget(userUsage, null, 5.0)
      expect(result.allowed).toBe(true)
    })

    it('should block request when user budget exceeded', () => {
      const userUsage: UsageRecord[] = [
        { cost_usd: 8.0, status: 'ok' },
      ]
      const result = checkBudget(userUsage, null, 3.0)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('User daily budget exceeded')
    })

    it('should block request when project budget exceeded', () => {
      const userUsage: UsageRecord[] = [{ cost_usd: 1.0, status: 'ok' }]
      const projectUsage: UsageRecord[] = [{ cost_usd: 4.5, status: 'ok' }]
      const result = checkBudget(userUsage, projectUsage, 1.0)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Project daily budget exceeded')
    })

    it('should not count failed requests in budget', () => {
      const userUsage: UsageRecord[] = [
        { cost_usd: 9.0, status: 'ok' },
        { cost_usd: 5.0, status: 'failed' }, // Should not count
      ]
      const result = checkBudget(userUsage, null, 0.5)
      expect(result.allowed).toBe(true)
    })

    it('should allow request at exact budget limit', () => {
      const userUsage: UsageRecord[] = [{ cost_usd: 5.0, status: 'ok' }]
      const result = checkBudget(userUsage, null, 5.0)
      expect(result.allowed).toBe(true)
    })

    it('should block request just over budget', () => {
      const userUsage: UsageRecord[] = [{ cost_usd: 9.99, status: 'ok' }]
      const result = checkBudget(userUsage, null, 0.02)
      expect(result.allowed).toBe(false)
    })
  })
})
