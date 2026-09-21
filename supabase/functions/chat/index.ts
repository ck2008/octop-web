/**
 * chat - the only path from the browser to OpenAI.
 *
 * The browser never writes a message and never holds an OpenAI key. This
 * function owns the whole sequence: authenticate, verify ownership, store the
 * user message, call the model, store the reply.
 *
 * Every database statement runs through a client built from the caller's own
 * Authorization header, so Row Level Security - not this code - is the access
 * boundary. No service role key is used anywhere in this file.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

const DEFAULT_MODEL = 'gpt-5.6-luna'
const MAX_MESSAGE_LENGTH = 20_000
const HISTORY_LIMIT = 30
const TITLE_MAX_LENGTH = 40
const OPENAI_TIMEOUT_MS = 90_000

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Allowed browser origins, comma separated, e.g.
 *   http://localhost:5173,https://ck2008.github.io
 * A path on a project page is irrelevant here: an Origin is only
 * scheme + host + port.
 */
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const FALLBACK_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

// --------------------------------------------------------------------------
// CORS
// --------------------------------------------------------------------------

/**
 * Reflects the request Origin only when it is on the allow list. A wildcard is
 * never returned, because these requests carry the caller's bearer token.
 */
function corsHeaders(origin: string | null): Record<string, string> {
  const allowList =
    ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : FALLBACK_ORIGINS

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, apikey, content-type, x-client-info',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }

  if (origin && allowList.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }

  return headers
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

function errorResponse(
  message: string,
  status: number,
  origin: string | null,
): Response {
  return jsonResponse({ error: message }, status, origin)
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

interface ChatRequestBody {
  conversationId?: unknown
  message?: unknown
}

/** First 40 characters of the opening message, single-lined. No model call. */
function deriveTitle(message: string): string | null {
  const flattened = message.replace(/\s+/g, ' ').trim()
  if (!flattened) return null
  return flattened.length > TITLE_MAX_LENGTH
    ? flattened.slice(0, TITLE_MAX_LENGTH)
    : flattened
}

/**
 * The Responses API returns `output_text` in most cases; the walk over
 * `output` is the documented fallback for shapes that omit it.
 */
function extractText(payload: unknown): string {
  const root = payload as {
    output_text?: unknown
    output?: Array<{
      type?: string
      content?: Array<{ type?: string; text?: unknown }>
    }>
  }

  if (typeof root.output_text === 'string' && root.output_text.trim()) {
    return root.output_text.trim()
  }

  if (Array.isArray(root.output_text)) {
    const joined = root.output_text.filter((p) => typeof p === 'string').join('')
    if (joined.trim()) return joined.trim()
  }

  const parts: string[] = []
  for (const item of root.output ?? []) {
    if (item?.type && item.type !== 'message') continue
    for (const chunk of item?.content ?? []) {
      if (chunk?.type === 'output_text' && typeof chunk.text === 'string') {
        parts.push(chunk.text)
      }
    }
  }

  return parts.join('').trim()
}

// --------------------------------------------------------------------------
// Handler
// --------------------------------------------------------------------------

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get('Origin')
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405, origin)
  }

  // --- Authentication ----------------------------------------------------
  //
  // The user identity comes from the verified JWT only. Nothing in the request
  // body is trusted to say who the caller is.

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('Not authenticated.', 401, origin)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey =
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !anonKey) {
    console.error(
      JSON.stringify({ requestId, error: 'config', detail: 'missing_supabase_env' }),
    )
    return errorResponse('Server is not configured.', 500, origin)
  }

  // Built from the publishable key plus the caller's header: this client is the
  // user, so RLS applies to every statement below.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return errorResponse('Not authenticated.', 401, origin)
  }
  const userId = authData.user.id

  // --- Request validation ------------------------------------------------

  let body: ChatRequestBody
  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return errorResponse('Request body must be JSON.', 400, origin)
  }

  const conversationId = body.conversationId
  const rawMessage = body.message

  if (typeof conversationId !== 'string' || !UUID_PATTERN.test(conversationId)) {
    return errorResponse('conversationId must be a UUID.', 400, origin)
  }
  if (typeof rawMessage !== 'string') {
    return errorResponse('message must be a string.', 400, origin)
  }

  const message = rawMessage.trim()
  if (!message) {
    return errorResponse('message cannot be empty.', 400, origin)
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return errorResponse(
      `message exceeds ${MAX_MESSAGE_LENGTH} characters.`,
      400,
      origin,
    )
  }

  console.log(
    JSON.stringify({ requestId, event: 'request_started', userId, conversationId }),
  )

  // --- Ownership --------------------------------------------------------
  //
  // RLS already hides other people's rows, so a foreign id simply returns
  // nothing. The explicit owner comparisons below restate the invariant rather
  // than relying on the policy alone.

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id, project_id, agent_id, owner_id, title')
    .eq('id', conversationId)
    .maybeSingle()

  if (conversationError) {
    console.error(
      JSON.stringify({ requestId, error: 'db', stage: 'load_conversation' }),
    )
    return errorResponse('Could not load the conversation.', 500, origin)
  }
  if (!conversation) {
    return errorResponse('Conversation not found.', 404, origin)
  }
  if (conversation.owner_id !== userId) {
    return errorResponse('Forbidden.', 403, origin)
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, project_id, owner_id, system_prompt, model')
    .eq('id', conversation.agent_id)
    .maybeSingle()

  if (agentError) {
    console.error(JSON.stringify({ requestId, error: 'db', stage: 'load_agent' }))
    return errorResponse('Could not load the agent.', 500, origin)
  }
  if (!agent) {
    return errorResponse('Agent not found.', 404, origin)
  }
  if (agent.owner_id !== userId) {
    return errorResponse('Forbidden.', 403, origin)
  }
  if (
    agent.id !== conversation.agent_id ||
    agent.project_id !== conversation.project_id
  ) {
    return errorResponse('Forbidden.', 403, origin)
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('id', conversation.project_id)
    .maybeSingle()

  if (projectError) {
    console.error(
      JSON.stringify({ requestId, error: 'db', stage: 'load_project' }),
    )
    return errorResponse('Could not load the project.', 500, origin)
  }
  if (!project) {
    return errorResponse('Project not found.', 404, origin)
  }
  if (project.owner_id !== userId) {
    return errorResponse('Forbidden.', 403, origin)
  }

  // --- History ----------------------------------------------------------
  //
  // Newest 30 rows, then reversed back into chronological order. Keeps the
  // context bounded without summarising anything.

  const { data: recent, error: historyError } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (historyError) {
    console.error(
      JSON.stringify({ requestId, error: 'db', stage: 'load_history' }),
    )
    return errorResponse('Could not load the conversation history.', 500, origin)
  }

  // Only role and content reach the model - never owner_id, email or any other
  // database metadata.
  const history = (recent ?? [])
    .slice()
    .reverse()
    .map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
    }))

  // --- Store the user message -------------------------------------------

  const { data: userMessage, error: insertUserError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      owner_id: userId,
      role: 'user',
      content: message,
    })
    .select('id')
    .single()

  if (insertUserError || !userMessage) {
    console.error(
      JSON.stringify({ requestId, error: 'db', stage: 'insert_user_message' }),
    )
    return errorResponse('Could not save your message.', 500, origin)
  }

  // --- Call OpenAI ------------------------------------------------------

  const openAiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openAiKey) {
    console.error(
      JSON.stringify({ requestId, error: 'config', detail: 'missing_openai_key' }),
    )
    // The user message is kept; no fabricated assistant reply is written.
    return errorResponse('The model is not configured.', 500, origin)
  }

  // The client cannot choose a model: agent.model is set by the owner through
  // RLS-protected writes, and otherwise the server default applies.
  const model =
    agent.model?.trim() || Deno.env.get('OPENAI_MODEL')?.trim() || DEFAULT_MODEL

  const instructions = agent.system_prompt?.trim()

  let assistantText: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

    let openAiResponse: Response
    try {
      openAiResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          ...(instructions ? { instructions } : {}),
          input: [...history, { role: 'user', content: message }],
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!openAiResponse.ok) {
      // Status and duration only - never the response body, which can echo
      // request content, and never the key.
      console.error(
        JSON.stringify({
          requestId,
          error: 'openai_http',
          status: openAiResponse.status,
          durationMs: Date.now() - startedAt,
        }),
      )
      const status = openAiResponse.status === 429 ? 429 : 502
      return errorResponse(
        status === 429
          ? 'Too many requests. Please wait a moment and try again.'
          : 'The model did not respond. Please try again.',
        status,
        origin,
      )
    }

    assistantText = extractText(await openAiResponse.json())
  } catch (cause) {
    console.error(
      JSON.stringify({
        requestId,
        error: 'openai_network',
        name: cause instanceof Error ? cause.name : 'unknown',
        durationMs: Date.now() - startedAt,
      }),
    )
    return errorResponse('The model did not respond. Please try again.', 502, origin)
  }

  if (!assistantText) {
    console.error(JSON.stringify({ requestId, error: 'openai_empty_output' }))
    return errorResponse('The model returned an empty reply.', 502, origin)
  }

  // --- Store the reply ---------------------------------------------------

  const { data: assistantMessage, error: insertAssistantError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      owner_id: userId,
      role: 'assistant',
      content: assistantText,
    })
    .select('id, role, content, created_at')
    .single()

  if (insertAssistantError || !assistantMessage) {
    console.error(
      JSON.stringify({ requestId, error: 'db', stage: 'insert_assistant_message' }),
    )
    return errorResponse('Could not save the reply.', 500, origin)
  }

  // --- Title and updated_at ---------------------------------------------
  //
  // The updated_at trigger fires on any UPDATE, so touching the row is enough
  // to move the conversation to the top of the list.

  const derivedTitle =
    conversation.title === 'New Chat' ? deriveTitle(message) : null

  const { error: touchError } = await supabase
    .from('conversations')
    .update(derivedTitle ? { title: derivedTitle } : { title: conversation.title })
    .eq('id', conversation.id)

  if (touchError) {
    // Cosmetic only - the messages are already stored, so the reply still goes
    // back to the browser.
    console.error(
      JSON.stringify({ requestId, error: 'db', stage: 'update_conversation' }),
    )
  }

  console.log(
    JSON.stringify({
      requestId,
      event: 'request_completed',
      userId,
      conversationId: conversation.id,
      model,
      durationMs: Date.now() - startedAt,
    }),
  )

  return jsonResponse(
    {
      message: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        created_at: assistantMessage.created_at,
      },
    },
    200,
    origin,
  )
})
