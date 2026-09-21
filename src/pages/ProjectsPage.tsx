import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { PageLoader } from '../components/Spinner'
import { LIMITS } from '../config/app'
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from '../services/projects'
import type { Project } from '../types/database'

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Project | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProjects(await listProjects())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load projects.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (loading) return <PageLoader label="Loading projects…" />

  return (
    <section className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Projects</h1>
          <p className="page__subtitle">
            A project groups the agents and chats that belong together.
          </p>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreating(true)}
        >
          New project
        </button>
      </div>

      {error && <p className="form__error">{error}</p>}

      {projects.length === 0 && !error ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start adding agents."
          action={
            <button
              type="button"
              className="button button--primary"
              onClick={() => setCreating(true)}
            >
              Create project
            </button>
          }
        />
      ) : (
        <ul className="card-grid">
          {projects.map((project) => (
            <li key={project.id} className="card">
              <Link to={`/projects/${project.id}`} className="card__main">
                <h2 className="card__title">{project.name}</h2>
                {project.description && (
                  <p className="card__text">{project.description}</p>
                )}
                <p className="card__meta">
                  Updated {formatDate(project.updated_at)}
                </p>
              </Link>
              <div className="card__actions">
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => setEditing(project)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small button--danger-text"
                  onClick={() => setDeleting(project)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProjectFormModal
        open={creating || editing !== null}
        project={editing}
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
        title={`Delete ${deleting?.name ?? 'project'}?`}
        message="Deleting this project will also delete its agents, conversations and messages. This cannot be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await deleteProject(deleting.id)
          setDeleting(null)
          await refresh()
        }}
      />
    </section>
  )
}

interface ProjectFormModalProps {
  open: boolean
  /** null means "create", a row means "edit". */
  project: Project | null
  onClose: () => void
  onSaved: () => void
}

function ProjectFormModal({
  open,
  project,
  onClose,
  onSaved,
}: ProjectFormModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Reset the fields every time the modal opens for a different row.
  useEffect(() => {
    if (!open) return
    setName(project?.name ?? '')
    setDescription(project?.description ?? '')
    setError(null)
    setStatus('idle')
  }, [open, project])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (status === 'saving') return

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Project name cannot be empty.')
      return
    }

    setStatus('saving')
    setError(null)
    try {
      if (project) {
        await updateProject(project.id, { name: trimmed, description })
      } else {
        await createProject({ name: trimmed, description })
      }
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.')
      setStatus('idle')
    }
  }

  return (
    <Modal
      open={open}
      title={project ? 'Edit project' : 'New project'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="field__input"
            value={name}
            maxLength={LIMITS.projectName}
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
            rows={3}
            onChange={(event) => setDescription(event.target.value)}
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
