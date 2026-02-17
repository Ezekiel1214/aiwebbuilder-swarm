import { ProjectEvent, ProjectSnapshot, isProjectRenameEvent } from './types'

/**
 * Deterministic Event Reducer
 * 
 * Applies a single event to a snapshot to produce a new snapshot.
 * This function must be PURE - no side effects, no randomness, no external IO.
 * 
 * @param snapshot - The current state snapshot
 * @param event - The event to apply
 * @returns A new snapshot with the event applied
 * @throws Error if event type is unknown or payload is invalid
 */
export function applyEvent(snapshot: ProjectSnapshot, event: ProjectEvent): ProjectSnapshot {
  // Validate event
  if (!event || typeof event !== 'object') {
    throw new Error('Invalid event: must be an object')
  }

  if (!event.type || typeof event.type !== 'string') {
    throw new Error('Invalid event: must have a type string')
  }

  // Apply event based on type
  switch (event.type) {
    case 'project.rename':
      return applyRenameEvent(snapshot, event)
    
    default:
      throw new Error(`Unknown event type: ${event.type}`)
  }
}

/**
 * Apply a project.rename event
 */
function applyRenameEvent(snapshot: ProjectSnapshot, event: ProjectEvent): ProjectSnapshot {
  if (!isProjectRenameEvent(event)) {
    throw new Error('Invalid project.rename event structure')
  }

  const { name } = event.payload

  // Validate payload
  if (typeof name !== 'string') {
    throw new Error('Invalid project.rename payload: name must be a string')
  }

  if (name.length === 0) {
    throw new Error('Invalid project.rename payload: name cannot be empty')
  }

  if (name.length > 200) {
    throw new Error('Invalid project.rename payload: name exceeds maximum length of 200')
  }

  // Return new snapshot (immutable update)
  return {
    ...snapshot,
    name,
  }
}

/**
 * Apply multiple events in sequence
 * 
 * @param initialSnapshot - Starting snapshot (defaults to empty)
 * @param events - Array of events to apply
 * @returns Final snapshot after applying all events
 */
export function applyEvents(
  events: ProjectEvent[],
  initialSnapshot: ProjectSnapshot = {}
): ProjectSnapshot {
  return events.reduce((snapshot, event) => applyEvent(snapshot, event), initialSnapshot)
}

/**
 * Create an initial empty snapshot
 */
export function createInitialSnapshot(): ProjectSnapshot {
  return {}
}
