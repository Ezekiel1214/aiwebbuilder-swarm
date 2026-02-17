/**
 * Event Types for Project Event Sourcing
 * 
 * All events are append-only and immutable.
 * The reducer must be deterministic and pure.
 */

// Base event structure
export interface BaseEvent {
  type: string
  payload: Record<string, unknown>
}

// Project Rename Event
export interface ProjectRenameEvent {
  type: 'project.rename'
  payload: {
    name: string
  }
}

// Union type of all project events
export type ProjectEvent = ProjectRenameEvent

// Snapshot shape - the current state derived from events
export interface ProjectSnapshot {
  name?: string
  // Future fields will be added here:
  // elements?: Element[]
  // settings?: ProjectSettings
  // etc.
}

// Valid event types (for runtime validation)
export const VALID_EVENT_TYPES = ['project.rename'] as const

// Type guard for project rename event
export function isProjectRenameEvent(event: ProjectEvent): event is ProjectRenameEvent {
  return event.type === 'project.rename'
}
