import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useEffect, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { dismissTopOverlay, pushBackHandler } from '@/services/native/back-button'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px]',
        'data-[state=open]:animate-[pop_0.18s_ease-out] data-[state=closed]:opacity-0',
        className,
      )}
      {...props}
    />
  )
}

export interface DialogContentProps
  extends Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> {
  title: ReactNode
  description?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  hideClose?: boolean
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
} as const

export function DialogContent({
  title,
  description,
  footer,
  size = 'md',
  hideClose,
  className,
  children,
  ...props
}: DialogContentProps) {
  /*
   * On Android the hardware back button should close the dialog, not navigate
   * the app behind it. Radix only listens for `Escape`, so the dialog claims
   * the back press while it is open.
   */
  useEffect(() => pushBackHandler(() => dismissTopOverlay()), [])

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
          'rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_24px_60px_-24px_rgb(55_49_61_/_0.35)]',
          'data-[state=open]:animate-[rise_0.24s_cubic-bezier(0.22,1,0.36,1)] focus:outline-none',
          SIZES[size],
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="font-display text-base font-bold text-[var(--fg)]">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-xs text-[var(--fg-muted)]">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">
                {typeof title === 'string' ? title : 'Dialog'}
              </DialogPrimitive.Description>
            )}
          </div>
          {hideClose ? null : (
            <DialogPrimitive.Close
              className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
