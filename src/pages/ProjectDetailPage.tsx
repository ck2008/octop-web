import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { PageLoader } from '../components/Spinner'
import { LIMITS } from '../config/app'
import {
  createAgent,
  deleteAgent,
  listAgents,
  updateAgent,
} from '../services/agents'
import { getProject } from '../services/projects'
import type { Agent, Project } from '../types/database'

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()

  const [project, setProject] = useState<Project | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Agent | null>(null)
  const [deleting, setDeleting] = useState<Agent | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [loadedProject, loadedAgents] = await Promise.all([
        getProject(projectId),
        listAgents(projectId),
      ])
      setProject(loadedProject)
      setAgents(loadedAgents)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load this project.',
      )
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (loading) return <PageLoader label="Loading project…" />

  if (error || !project) {
    return (
      <section className="page">
        <EmptyState
          title="Project not found"
          description={error ?? 'It may have been deleted.'}
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
    <section className="page">
      <nav className="breadcrumb">
        <Link to="/">Projects</Link>
        <span aria-hidden="true">/</span>
        <span>{project.name}</span>
      </nav>

      <div className="page__header">
        <div>
          <h1 className="page__title">{project.name}</h1>
          {project.description && (
            <p className="page__subtitle">{project.description}</p>
          )}
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreating(true)}
        >
          New agent
        </button>
      </div>

      <h2 className="section-title">Agents</h2>

      {agents.length === 0 ? (
        <EmptyState
          title="No agents yet"
          description="An agent is a system prompt plus an optional model override."
          action={
            <button
              type="button"
              className="button button--primary"
              onClick={() => setCreating(true)}
            >
              Create agent
            </button>
          }
        />
      ) : (
        <ul className="card-grid">
          {agents.map((agent) => (
            <li key={agent.id} className="card">
              <Link
                to={`/projects/${project.id}/agents/${agent.id}`}
                className="card__main"
              >
                <h3 className="card__title">{agent.name}</h3>
                {agent.description && (
                  <p className="card__text">{agent.description}</p>
                )}
                <p className="card__meta">
                  {agent.model ? `Model: ${agent.model}` : 'Default model'}
                </p>
              </Link>
              <div className="card__actions">
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => setEditing(agent)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small button--danger-text"
                  onClick={() => setDeleting(agent)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AgentFormModal
        open={creating || editing !== null}
        projectId={project.id}
        agent={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSaved={() => {
          setCreating(false)
          setEditing(null)
          void refresh()
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'agent'}?`}
        message="Deleting this agent will also delete its conversations and messages. This cannot be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await deleteAgent(deleting.id)
          setDeleting(null)
          await refresh()
        }}
      />
    </section>
  )
}

interface AgentFormModalProps {
  open: boolean
  projectId: string
  agent: Agent | null
  onClose: () => void
  onSaved: () => void
}

function AgentFormModal({
  open,
  projectId,
  agent,
  onClose,
  onSaved,
}: AgentFormModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(agent?.name ?? '')
    setDescription(agent?.description ?? '')
    setSystemPrompt(agent?.system_prompt ?? '')
    setModel(agent?.model ?? '')
    setError(null)
    setStatus('idle')
  }, [open, agent])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (status === 'saving') return

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Agent name cannot be empty.')
      return
    }

    setStatus('saving')
    setError(null)
    try {
      const input = { name: trimmed, description, systemPrompt, model }
      if (agent) {
        await updateAgent(agent.id, input)
      } else {
        await createAgent(projectId, input)
      }
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.')
      setStatus('idle')
    }
  }

  return (
    <Modal open={open} title={agent ? 'Edit agent' : 'New agent'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="field__input"
            value={name}
            maxLength={LIMITS.agentName}
            onChange={(event) => setName(event.target.value)}
            disabled={status === 'saving'}
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="field__input field__input--textarea"
            value={description}
            maxLength={LIMITS.description}
            rows={2}
            onChange={(event) => setDescription(event.target.value)}
            disabled={status === 'saving'}
          />
        </label>

        <label className="field">
          <span className="field__label">
            System prompt
            <span className="field__hint">
              {systemPrompt.length} / {LIMITS.systemPrompt}
            </span>
          </span>
          <textarea
            className="field__input field__input--textarea"
            value={systemPrompt}
            maxLength={LIMITS.systemPrompt}
            rows={6}
            placeholder="You are a helpful assistant…"
            onChange={(event) => setSystemPrompt(event.target.value)}
            disabled={status === 'saving'}
          />
        </label>

        <label className="field">
          <span className="field__label">
            Model
            <span className="field__hint">optional</span>
          </span>
          <input
            className="field__input"
            value={model}
            placeholder="Leave blank to use the system default model"
            onChange={(event) => setModel(event.target.value)}
            disabled={status === 'saving'}
          />
        </label>

        {error && <p className="form__error">{error}</p>}

        <div className="modal__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
            disabled={status === 'saving'}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={status === 'saving'}
          >
            {status === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
