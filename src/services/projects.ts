import { supabase } from '../lib/supabase'
import type { Project } from '../types/database'

export interface ProjectInput {
  name: string
  description?: string | null
}

/**
 * Every query below is still filtered by owner in the policy layer; the
 * explicit ordering here is only about presentation.
 */
export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw new Error('Not signed in.')

  const { data, error } = await supabase
    .from('projects')
    .insert({
      owner_id: auth.user.id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateProject(
  id: string,
  input: ProjectInput,
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/** Agents, conversations and messages disappear with it, by cascade. */
export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}
