import { useState } from 'react'

import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Spell out cascading deletes here - the user needs to know what goes. */
  message: string
  confirmLabel?: string
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title={title} onClose={busy ? () => {} : onCancel}>
      <p className="confirm__message">{message}</p>
      {error && <p className="form__error">{error}</p>}
      <div className="modal__actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={handleConfirm}
          disabled={busy}
        >
          {busy ? 'Deleting…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
