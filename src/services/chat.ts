import { LIMITS } from '../config/app'
import { supabase } from '../lib/supabase'
import type { MessageRole } from '../types/database'

export interface ChatReply {
  id: string
  role: MessageRole
  content: string
  created_at?: string
}

interface ChatResponseBody {
  message?: ChatReply
  error?: string
}

/** Thrown for anything the user can act on; carries the HTTP status when known. */
export class ChatError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ChatError'
    this.status = status
  }
}

function messageForStatus(status: number | undefined, fallback: string) {
  switch (status) {
    case 400:
      return 'The message could not be sent - please check the content and try again.'
    case 401:
      return 'Your session has expired. Please sign in again.'
    case 403:
      return 'You do not have access to this conversation.'
    case 404:
      return 'This conversation or its agent no longer exists.'
    case 429:
      return 'Too many requests. Please wait a moment and try again.'
    case 502:
      return 'The model did not respond. Your message was not sent - you can try again.'
    default:
      return fallback
  }
}

/**
 * The browser never writes the user message and never talks to OpenAI. The
 * Edge Function owns the whole sequence: authenticate, verify ownership, store
 * the user message, call the model, store the reply.
 */
export async function sendChatMessage(
  conversationId: string,
  message: string,
): Promise<ChatReply> {
  const trimmed = message.trim()

  if (!trimmed) {
    throw new ChatError('Enter a message before sending.')
  }
  if (trimmed.length > LIMITS.chatMessage) {
    throw new ChatError(
      `Message is too long (${trimmed.length} / ${LIMITS.chatMessage} characters).`,
    )
  }

  // invoke() attaches the current session automatically.
  const { data, error } = await supabase.functions.invoke<ChatResponseBody>(
    'chat',
    { body: { conversationId, message: trimmed } },
  )

  if (error) {
    // FunctionsHttpError carries the original Response, which holds the JSON
    // error body the function produced.
    const response = (error as { context?: Response }).context
    let status: number | undefined
    let serverMessage: string | undefined

    if (response instanceof Response) {
      status = response.status
      try {
        const body = (await response.clone().json()) as ChatResponseBody
        serverMessage = body.error
      } catch {
        // Non-JSON body - fall through to the status-based wording.
      }
    }

    throw new ChatError(
      messageForStatus(
        status,
        serverMessage ?? 'The reply failed. You can try sending it again.',
      ),
      status,
    )
  }

  if (!data?.message?.content) {
    throw new ChatError('The reply failed. You can try sending it again.')
  }

  return data.message
}
