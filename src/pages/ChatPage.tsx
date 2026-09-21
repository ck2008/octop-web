import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { MessageContent } from '../components/MessageContent'
import { PageLoader, Spinner } from '../components/Spinner'
import { LIMITS } from '../config/app'
import { getAgent } from '../services/agents'
import { sendChatMessage } from '../services/chat'
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  listMessages,
} from '../services/conversations'
import { getProject } from '../services/projects'
import type { Agent, Conversation, Message, Project } from '../types/database'

type SendStatus = 'idle' | 'sending' | 'error'

export function ChatPage() {
  const { conversationId = '' } = useParams()
  const navigate = useNavigate()

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [siblings, setSiblings] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
  const [sendError, setSendError] = useState<string | null>(null)

  const [deleting, setDeleting] = useState<Conversation | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const loadedConversation = await getConversation(conversationId)
      const [loadedAgent, loadedProject, loadedMessages, loadedSiblings] =
        await Promise.all([
          getAgent(loadedConversation.agent_id),
          getProject(loadedConversation.project_id),
          listMessages(loadedConversation.id),
          listConversations(loadedConversation.agent_id),
        ])

      setConversation(loadedConversation)
      setAgent(loadedAgent)
      setProject(loadedProject)
      setMessages(loadedMessages)
      setSiblings(loadedSiblings)
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? cause.message
          : 'Could not load this conversation.',
      )
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    void load()
  }, [load])

  // Keep the newest message in view as the transcript grows.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, sendStatus])

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    // Guard against double submit from Enter plus a click on the button.
    if (sendStatus === 'sending' || !conversation) return

    const trimmed = draft.trim()
    if (!trimmed) return

    setSendStatus('sending')
    setSendError(null)

    // Shown immediately so the transcript does not stall; the Edge Function is
    // what actually writes it, and the reload below replaces this placeholder
    // with the stored row.
    const pending: Message = {
      id: `pending-${Date.now()}`,
      conversation_id: conversation.id,
      owner_id: conversation.owner_id,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    }
    setMessages((current) => [...current, pending])
    setDraft('')

    try {
      await sendChatMessage(conversation.id, trimmed)

      // Re-read from the database so ids, timestamps and the generated title
      // all come from the source of truth.
      const [freshMessages, freshConversation, freshSiblings] =
        await Promise.all([
          listMessages(conversation.id),
          getConversation(conversation.id),
          listConversations(conversation.agent_id),
        ])
      setMessages(freshMessages)
      setConversation(freshConversation)
      setSiblings(freshSiblings)
      setSendStatus('idle')
    } catch (cause) {
      // Drop the optimistic row and hand the text back so it can be resent.
      setMessages((current) => current.filter((item) => item.id !== pending.id))
      setDraft(trimmed)
      setSendError(
        cause instanceof Error
          ? cause.message
          : 'The reply failed. You can try sending it again.',
      )
      setSendStatus('error')
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  async function startNewChat() {
    if (!conversation) return
    const created = await createConversation(
      conversation.project_id,
      conversation.agent_id,
    )
    navigate(`/chat/${created.id}`)
  }

  if (loading) return <PageLoader label="Loading conversation…" />

  if (loadError || !conversation || !agent || !project) {
    return (
      <section className="page">
        <EmptyState
          title="Conversation not found"
          description={loadError ?? 'It may have been deleted.'}
          action={
            <Link to="/" className="button button--primary">
              Back to projects
            </Link>
          }
        />
      </section>
    )
  }

  return (
    <section className="chat">
      <div className="chat__topbar">
        <button
          type="button"
          className="button button--ghost button--small chat__sidebar-toggle"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          {sidebarOpen ? 'Hide chats' : 'Chats'}
        </button>
        <nav className="breadcrumb breadcrumb--compact">
          <Link to={`/projects/${project.id}`}>{project.name}</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/projects/${project.id}/agents/${agent.id}`}>
            {agent.name}
          </Link>
        </nav>
      </div>

      <div className="chat__body">
        <aside
          className={`chat__sidebar${sidebarOpen ? ' chat__sidebar--open' : ''}`}
        >
          <button
            type="button"
            className="button button--primary button--block"
            onClick={startNewChat}
          >
            New Chat
          </button>
          <ul className="chat__list">
            {siblings.map((item) => (
              <li
                key={item.id}
                className={`chat__list-item${
                  item.id === conversation.id ? ' chat__list-item--active' : ''
                }`}
              >
                <Link
                  to={`/chat/${item.id}`}
                  className="chat__list-link"
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="chat__list-title">{item.title}</span>
                  <span className="chat__list-meta">
                    {new Date(item.updated_at).toLocaleDateString()}
                  </span>
                </Link>
                <button
                  type="button"
                  className="button button--ghost button--icon button--danger-text"
                  onClick={() => setDeleting(item)}
                  aria-label={`Delete ${item.title}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="chat__main">
          <div className="chat__scroll" ref={scrollRef}>
            {messages.length === 0 ? (
              <EmptyState
                title="Say hello"
                description={`Send the first message to ${agent.name}.`}
              />
            ) : (
              <ul className="chat__messages">
                {messages.map((message) => (
                  <li
                    key={message.id}
                    className={`message message--${message.role}`}
                  >
                    <span className="message__role">
                      {message.role === 'user' ? 'You' : agent.name}
                    </span>
                    <MessageContent content={message.content} />
                  </li>
                ))}
              </ul>
            )}

            {sendStatus === 'sending' && (
              <div className="chat__pending">
                <Spinner label={`${agent.name} is thinking…`} />
              </div>
            )}
          </div>

          <form className="chat__composer" onSubmit={handleSend}>
            {sendError && (
              <p className="form__error chat__error" role="alert">
                {sendError}
              </p>
            )}
            <div className="chat__composer-row">
              <textarea
                className="chat__textarea"
                value={draft}
                rows={3}
                maxLength={LIMITS.chatMessage}
                placeholder="Type a message. Enter to send, Shift+Enter for a new line."
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sendStatus === 'sending'}
              />
              <button
                type="submit"
                className="button button--primary"
                disabled={sendStatus === 'sending' || !draft.trim()}
              >
                {sendStatus === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this conversation?"
        message="Its messages will be deleted as well. This cannot be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          const wasCurrent = deleting.id === conversation.id
          await deleteConversation(deleting.id)
          setDeleting(null)
          if (wasCurrent) {
            navigate(`/projects/${project.id}/agents/${agent.id}`)
          } else {
            setSiblings(await listConversations(agent.id))
          }
        }}
      />
    </section>
  )
}
