import { describe, it, expect } from 'vitest'
import { applyEvent, applyEvents, createInitialSnapshot } from '@/state/reducer'
import { ProjectEvent, ProjectSnapshot } from '@/state/types'

describe('Event Reducer', () => {
  describe('applyEvent', () => {
    it('should apply project.rename event correctly', () => {
      const snapshot: ProjectSnapshot = {}
      const event: ProjectEvent = {
        type: 'project.rename',
        payload: { name: 'New Project Name' },
      }

      const result = applyEvent(snapshot, event)

      expect(result).toEqual({ name: 'New Project Name' })
    })

    it('should update existing name', () => {
      const snapshot: ProjectSnapshot = { name: 'Old Name' }
      const event: ProjectEvent = {
        type: 'project.rename',
        payload: { name: 'Updated Name' },
      }

      const result = applyEvent(snapshot, event)

      expect(result).toEqual({ name: 'Updated Name' })
    })

    it('should preserve other snapshot fields when renaming', () => {
      const snapshot: ProjectSnapshot = { 
        name: 'Old Name',
        // @ts-expect-error - testing future fields
        elements: [],
      }
      const event: ProjectEvent = {
        type: 'project.rename',
        payload: { name: 'New Name' },
      }

      const result = applyEvent(snapshot, event)

      expect(result.name).toBe('New Name')
      // @ts-expect-error - testing future fields
      expect(result.elements).toEqual([])
    })

    it('should be immutable (not mutate original snapshot)', () => {
      const snapshot: ProjectSnapshot = { name: 'Original' }
      const event: ProjectEvent = {
        type: 'project.rename',
        payload: { name: 'New Name' },
      }

      const result = applyEvent(snapshot, event)

      expect(snapshot.name).toBe('Original')
      expect(result.name).toBe('New Name')
      expect(result).not.toBe(snapshot)
    })

    it('should throw on unknown event type', () => {
      const snapshot: ProjectSnapshot = {}
      const event = {
        type: 'unknown.event',
        payload: {},
      } as unknown as ProjectEvent

      expect(() => applyEvent(snapshot, event)).toThrow('Unknown event type: unknown.event')
    })

    it('should throw on invalid event structure', () => {
      const snapshot: ProjectSnapshot = {}

      expect(() => applyEvent(snapshot, null as unknown as ProjectEvent)).toThrow('Invalid event')
      expect(() => applyEvent(snapshot, undefined as unknown as ProjectEvent)).toThrow('Invalid event')
      expect(() => applyEvent(snapshot, {} as ProjectEvent)).toThrow('Invalid event: must have a type string')
    })

    it('should throw on invalid payload (non-string name)', () => {
      const snapshot: ProjectSnapshot = {}
      const event = {
        type: 'project.rename',
        payload: { name: 123 },
      } as unknown as ProjectEvent

      expect(() => applyEvent(snapshot, event)).toThrow('name must be a string')
    })

    it('should throw on empty name', () => {
      const snapshot: ProjectSnapshot = {}
      const event: ProjectEvent = {
        type: 'project.rename',
        payload: { name: '' },
      }

      expect(() => applyEvent(snapshot, event)).toThrow('name cannot be empty')
    })

    it('should throw on name exceeding max length', () => {
      const snapshot: ProjectSnapshot = {}
      const event: ProjectEvent = {
        type: 'project.rename',
        payload: { name: 'a'.repeat(201) },
      }

      expect(() => applyEvent(snapshot, event)).toThrow('name exceeds maximum length')
    })

    it('should accept name at exact max length', () => {
      const snapshot: ProjectSnapshot = {}
      const event: ProjectEvent = {
        type: 'project.rename',
        payload: { name: 'a'.repeat(200) },
      }

      const result = applyEvent(snapshot, event)

      expect(result.name).toHaveLength(200)
    })
  })

  describe('applyEvents', () => {
    it('should apply multiple events in sequence', () => {
      const events: ProjectEvent[] = [
        { type: 'project.rename', payload: { name: 'First Name' } },
        { type: 'project.rename', payload: { name: 'Second Name' } },
        { type: 'project.rename', payload: { name: 'Final Name' } },
      ]

      const result = applyEvents(events)

      expect(result.name).toBe('Final Name')
    })

    it('should return initial snapshot for empty events array', () => {
      const result = applyEvents([])
      expect(result).toEqual({})
    })

    it('should use provided initial snapshot', () => {
      const initial: ProjectSnapshot = { name: 'Starting Name' }
      const events: ProjectEvent[] = [
        { type: 'project.rename', payload: { name: 'Updated Name' } },
      ]

      const result = applyEvents(events, initial)

      expect(result.name).toBe('Updated Name')
    })

    it('should be deterministic (same input = same output)', () => {
      const events: ProjectEvent[] = [
        { type: 'project.rename', payload: { name: 'Test Name' } },
      ]

      const result1 = applyEvents(events)
      const result2 = applyEvents(events)

      expect(result1).toEqual(result2)
    })
  })

  describe('createInitialSnapshot', () => {
    it('should return empty object', () => {
      const result = createInitialSnapshot()
      expect(result).toEqual({})
    })

    it('should return new object each time', () => {
      const result1 = createInitialSnapshot()
      const result2 = createInitialSnapshot()
      expect(result1).not.toBe(result2)
    })
  })

  describe('Determinism guarantees', () => {
    it('applying same event twice yields same result', () => {
      const snapshot: ProjectSnapshot = {}
      const event: ProjectEvent = {
        type: 'project.rename',
        payload: { name: 'Test' },
      }

      const result1 = applyEvent(snapshot, event)
      const result2 = applyEvent(snapshot, event)

      expect(result1).toEqual(result2)
    })

    it('order of events matters', () => {
      const snapshot: ProjectSnapshot = {}
      const events1: ProjectEvent[] = [
        { type: 'project.rename', payload: { name: 'First' } },
        { type: 'project.rename', payload: { name: 'Second' } },
      ]
      const events2: ProjectEvent[] = [
        { type: 'project.rename', payload: { name: 'Second' } },
        { type: 'project.rename', payload: { name: 'First' } },
      ]

      const result1 = applyEvents(events1, snapshot)
      const result2 = applyEvents(events2, snapshot)

      expect(result1.name).toBe('Second')
      expect(result2.name).toBe('First')
      expect(result1).not.toEqual(result2)
    })
  })
})
