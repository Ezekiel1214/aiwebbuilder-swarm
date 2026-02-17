export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          slug: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer'
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer'
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: 'owner' | 'editor' | 'viewer'
          created_at?: string
        }
        Relationships: []
      }
      project_events: {
        Row: {
          id: number
          project_id: string
          actor_id: string
          seq: number
          type: string
          payload: Json
          created_at: string
        }
        Insert: {
          id?: number
          project_id: string
          actor_id: string
          seq: number
          type: string
          payload: Json
          created_at?: string
        }
        Update: {
          id?: number
          project_id?: string
          actor_id?: string
          seq?: number
          type?: string
          payload?: Json
          created_at?: string
        }
        Relationships: []
      }
      project_projections: {
        Row: {
          project_id: string
          head_seq: number
          snapshot: Json
          updated_at: string
        }
        Insert: {
          project_id: string
          head_seq: number
          snapshot: Json
          updated_at?: string
        }
        Update: {
          project_id?: string
          head_seq?: number
          snapshot?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          id: number
          user_id: string
          project_id: string | null
          provider: string
          model: string
          tokens_in: number
          tokens_out: number
          cost_usd: number
          status: 'ok' | 'failed'
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          project_id?: string | null
          provider: string
          model: string
          tokens_in: number
          tokens_out: number
          cost_usd: number
          status: 'ok' | 'failed'
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          project_id?: string | null
          provider?: string
          model?: string
          tokens_in?: number
          tokens_out?: number
          cost_usd?: number
          status?: 'ok' | 'failed'
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
