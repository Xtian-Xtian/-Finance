import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './Button'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: 'md' | 'lg'
}

/** Accessible modal built on <dialog> (focus trapping + Esc handled by the browser). */
export function Modal({ open, title, onClose, children, footer, width = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      aria-labelledby="modal-title"
      className={`modal-enter m-auto w-[calc(100%-2rem)] ${width === 'lg' ? 'max-w-2xl' : 'max-w-lg'} glass-strong rounded-2xl border border-line-strong p-0 text-ink backdrop:bg-black/55 backdrop:backdrop-blur-md`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 id="modal-title" className="text-base font-semibold">
              {title}
            </h2>
            <IconButton label="Close" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
