import { supabase } from '../lib/supabase'
import type { Agent } from '../types/database'

export interface AgentInput {
  name: string
  description?: string | null
  systemPrompt: string
  /** Empty means "use the server default model". */
  model?: string | null
}

export async function listAgents(projectId: string): Promise<Agent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getAgent(id: string): Promise<Agent> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createAgent(
  projectId: string,
  input: AgentInput,
): Promise<Agent> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw new Error('Not signed in.')

  // The insert policy re-checks that this project belongs to the caller, so a
  // tampered projectId is rejected by the database rather than by this code.
  const { data, error } = await supabase
    .from('agents')
    .insert({
      project_id: projectId,
      owner_id: auth.user.id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      system_prompt: input.systemPrompt.trim(),
      model: input.model?.trim() || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateAgent(
  id: string,
  input: AgentInput,
): Promise<Agent> {
  const { data, error } = await supabase
    .from('agents')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      system_prompt: input.systemPrompt.trim(),
      model: input.model?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase.from('agents').delete().eq('id', id)
  if (error) throw error
}
