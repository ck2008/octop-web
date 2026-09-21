import { supabase } from '../lib/supabase'
import type { Conversation, Message } from '../types/database'

export async function listConversations(
  agentId: string,
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('agent_id', agentId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getConversation(id: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createConversation(
  projectId: string,
  agentId: string,
): Promise<Conversation> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw new Error('Not signed in.')

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      project_id: projectId,
      agent_id: agentId,
      owner_id: auth.user.id,
      title: 'New Chat',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', id)
  if (error) throw error
}

export async function listMessages(
  conversationId: string,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}
