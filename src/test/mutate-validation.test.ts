import { describe, it, expect } from 'vitest'

// Mirroring the Zod schema from supabase/functions/mutate/index.ts
interface MutateRequest {
  projectId: string
  baseSeq?: number
  proposal: {
    type: 'project.rename'
    payload: {
      name: string
    }
  }
  idempotencyKey?: string
}

function validateMutateRequest(body: unknown): { valid: boolean; error?: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be an object' }
  }

  const req = body as Partial<MutateRequest>

  // Validate projectId
  if (!req.projectId) {
    return { valid: false, error: 'projectId is required' }
  }
  
  // Simple UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(req.projectId)) {
    return { valid: false, error: 'projectId must be a valid UUID' }
  }

  // Validate proposal
  if (!req.proposal || typeof req.proposal !== 'object') {
    return { valid: false, error: 'proposal is required' }
  }

  if (req.proposal.type !== 'project.rename') {
    return { valid: false, error: 'proposal.type must be "project.rename"' }
  }

  if (!req.proposal.payload || typeof req.proposal.payload !== 'object') {
    return { valid: false, error: 'proposal.payload is required' }
  }

  const { name } = req.proposal.payload
  if (typeof name !== 'string') {
    return { valid: false, error: 'proposal.payload.name must be a string' }
  }

  if (name.length === 0) {
    return { valid: false, error: 'proposal.payload.name cannot be empty' }
  }

  if (name.length > 200) {
    return { valid: false, error: 'proposal.payload.name exceeds maximum length of 200' }
  }

  // Validate baseSeq if provided
  if (req.baseSeq !== undefined) {
    if (!Number.isInteger(req.baseSeq) || req.baseSeq < 0) {
      return { valid: false, error: 'baseSeq must be a non-negative integer' }
    }
  }

  return { valid: true }
}

describe('Mutate Request Validation', () => {
  describe('validateMutateRequest', () => {
    it('should validate valid project.rename request', () => {
      const result = validateMutateRequest({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        proposal: {
          type: 'project.rename',
          payload: { name: 'New Project Name' },
        },
      })
      expect(result.valid).toBe(true)
    })

    it('should validate with optional baseSeq', () => {
      const result = validateMutateRequest({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        baseSeq: 5,
        proposal: {
          type: 'project.rename',
          payload: { name: 'New Name' },
        },
        idempotencyKey: 'key-123',
      })
      expect(result.valid).toBe(true)
    })

    it('should reject missing projectId', () => {
      const result = validateMutateRequest({
        proposal: {
          type: 'project.rename',
          payload: { name: 'Test' },
        },
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('projectId')
    })

    it('should reject invalid UUID format', () => {
      const result = validateMutateRequest({
        projectId: 'not-a-uuid',
        proposal: {
          type: 'project.rename',
          payload: { name: 'Test' },
        },
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('UUID')
    })

    it('should reject missing proposal', () => {
      const result = validateMutateRequest({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('proposal')
    })

    it('should reject unknown event type', () => {
      const result = validateMutateRequest({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        proposal: {
          type: 'unknown.type',
          payload: { name: 'Test' },
        } as unknown as MutateRequest['proposal'],
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('project.rename')
    })

    it('should reject missing payload', () => {
      const result = validateMutateRequest({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        proposal: {
          type: 'project.rename',
        } as unknown as MutateRequest['proposal'],
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('payload')
    })

    it('should reject non-string name', () => {
      const result = validateMutateRequest({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        proposal: {
          type: 'project.rename',
          payload: { name: 123 },
        } as unknown as MutateRequest['proposal'],
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('name must be a string')
    })

    it('should reject empty name', () => {
      const result = validateMutateRequest({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        proposal: {
          type: 'project.rename',
          payload: { name: '' },
        },
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('cannot be empty')
    })

    it('should reject name exceeding max length', () => {
      const result = validateMutateRequest({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        proposal: {
          type: 'project.rename',
          payload: { name: 'a'.repeat(201) },
        },
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds maximum length')
    })

    it('should accept name at exact max length', () => {
      const result = validateMutateRequest({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        proposal: {
          type: 'project.rename',
          payload: { name: 'a'.repeat(200) },
        },
      })
      expect(result.valid).toBe(true)
    })

    it('should reject negative baseSeq', () => {
      const result = validateMutateRequest({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        baseSeq: -1,
        proposal: {
          type: 'project.rename',
          payload: { name: 'Test' },
        },
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('non-negative')
    })

    it('should reject non-integer baseSeq', () => {
      const result = validateMutateRequest({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        baseSeq: 1.5,
        proposal: {
          type: 'project.rename',
          payload: { name: 'Test' },
        },
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('integer')
    })

    it('should reject null body', () => {
      const result = validateMutateRequest(null)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('object')
    })

    it('should reject array body', () => {
      const result = validateMutateRequest([])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('object')
    })
  })
})
