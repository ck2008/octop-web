import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { PageLoader } from '../components/Spinner'
import { getAgent } from '../services/agents'
import {
  createConversation,
  deleteConversation,
  listConversations,
} from '../services/conversations'
import type { Agent, Conversation } from '../types/database'

export function AgentDetailPage() {
  const { projectId = '', agentId = '' } = useParams()
  const navigate = useNavigate()

  const [agent, setAgent] = useState<Agent | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [deleting, setDeleting] = useState<Conversation | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [loadedAgent, loadedConversations] = await Promise.all([
        getAgent(agentId),
        listConversations(agentId),
      ])
      setAgent(loadedAgent)
      setConversations(loadedConversations)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load this agent.',
      )
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function startChat() {
    if (!agent || starting) return
    setStarting(true)
    setError(null)
    try {
      const conversation = await createConversation(agent.project_id, agent.id)
      navigate(`/chat/${conversation.id}`)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not start a chat.',
      )
      setStarting(false)
    }
  }

  if (loading) return <PageLoader label="Loading agent…" />

  if (error || !agent) {
    return (
      <section className="page">
        <EmptyState
          title="Agent not found"
          description={error ?? 'It may have been deleted.'}
          action={
            <Link to={`/projects/${projectId}`} className="button button--primary">
              Back to project
            </Link>
          }
        />
      </section>
    )
  }

  return (
    <section className="page">
      <nav className="breadcrumb">
        <Link to="/">Projects</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/projects/${agent.project_id}`}>Project</Link>
        <span aria-hidden="true">/</span>
        <span>{agent.name}</span>
      </nav>

      <div className="page__header">
        <div>
          <h1 className="page__title">{agent.name}</h1>
          {agent.description && (
            <p className="page__subtitle">{agent.description}</p>
          )}
          <p className="page__meta">
            {agent.model ? `Model: ${agent.model}` : 'Using the default model'}
          </p>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={startChat}
          disabled={starting}
        >
          {starting ? 'Starting…' : 'New Chat'}
        </button>
      </div>

      <h2 className="section-title">Conversations</h2>

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Start a chat to talk to this agent."
          action={
            <button
              type="button"
              className="button button--primary"
              onClick={startChat}
              disabled={starting}
            >
              New Chat
            </button>
          }
        />
      ) : (
        <ul className="list">
          {conversations.map((conversation) => (
            <li key={conversation.id} className="list__row">
              <Link to={`/chat/${conversation.id}`} className="list__main">
                <span className="list__title">{conversation.title}</span>
                <span className="list__meta">
                  Updated {new Date(conversation.updated_at).toLocaleString()}
                </span>
              </Link>
              <button
                type="button"
                className="button button--ghost button--small button--danger-text"
                onClick={() => setDeleting(conversation)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this conversation?"
        message="Its messages will be deleted as well. This cannot be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await deleteConversation(deleting.id)
          setDeleting(null)
          await refresh()
        }}
      />
    </section>
  )
}
