/**
 * Hand-maintained mirror of `supabase/migrations/*_initial_schema.sql`.
 *
 * Once the hosted project exists this file can be regenerated with:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type MessageRole = 'user' | 'assistant'

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
      profiles: {
        Row: {
          id: string
          display_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          id: string
          project_id: string
          owner_id: string
          name: string
          description: string | null
          system_prompt: string
          model: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          owner_id: string
          name: string
          description?: string | null
          system_prompt?: string
          model?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          system_prompt?: string
          model?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          project_id: string
          agent_id: string
          owner_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          agent_id: string
          owner_id: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          owner_id: string
          role: MessageRole
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          owner_id: string
          role: MessageRole
          content: string
          created_at?: string
        }
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type Tables = Database['public']['Tables']

export type Profile = Tables['profiles']['Row']
export type Project = Tables['projects']['Row']
export type Agent = Tables['agents']['Row']
export type Conversation = Tables['conversations']['Row']
export type Message = Tables['messages']['Row']
