import { describe, it, expect } from 'vitest'

// Schema validation tests (mirrors Edge Function validation)
interface AIProxyRequest {
  project_id?: string
  prompt: string
  provider: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'mistral'
  model: string
}

function validateRequest(body: unknown): { valid: boolean; error?: string } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: 'Request body must be an object' }
  }
  
  const req = body as Partial<AIProxyRequest>
  
  if (req.prompt === undefined || req.prompt === null) {
    return { valid: false, error: 'Prompt is required and must be a string' }
  }

  if (typeof req.prompt !== 'string') {
    return { valid: false, error: 'Prompt is required and must be a string' }
  }

  if (req.prompt.length === 0) {
    return { valid: false, error: 'Prompt cannot be empty' }
  }
  
  if (req.prompt.length > 10000) {
    return { valid: false, error: 'Prompt exceeds maximum length of 10000 characters' }
  }
  
  const validProviders = ['openai', 'anthropic', 'gemini', 'groq', 'mistral']
  if (req.provider && !validProviders.includes(req.provider)) {
    return { valid: false, error: 'Invalid provider' }
  }
  
  return { valid: true }
}

describe('AI Proxy Request Validation', () => {
  describe('validateRequest', () => {
    it('should validate valid request', () => {
      const result = validateRequest({
        prompt: 'Create a hero section',
        provider: 'openai',
        model: 'gpt-4',
      })
      expect(result.valid).toBe(true)
    })

    it('should reject missing prompt', () => {
      const result = validateRequest({
        provider: 'openai',
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Prompt is required')
    })

    it('should reject empty prompt', () => {
      const result = validateRequest({
        prompt: '',
        provider: 'openai',
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('cannot be empty')
    })

    it('should reject prompt exceeding max length', () => {
      const result = validateRequest({
        prompt: 'a'.repeat(10001),
        provider: 'openai',
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds maximum length')
    })

    it('should reject invalid provider', () => {
      const result = validateRequest({
        prompt: 'Test',
        provider: 'invalid-provider' as unknown as AIProxyRequest['provider'],
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid provider')
    })

    it('should accept all valid providers', () => {
      const providers = ['openai', 'anthropic', 'gemini', 'groq', 'mistral']
      providers.forEach(provider => {
        const result = validateRequest({
          prompt: 'Test',
          provider: provider as AIProxyRequest['provider'],
        })
        expect(result.valid).toBe(true)
      })
    })
  })
})
