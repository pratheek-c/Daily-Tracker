import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { AlertTriangle } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { Button } from './button'
import { cn } from '@/lib/utils'

export const ConfirmDialog = AlertDialogPrimitive.Root
export const ConfirmDialogTrigger = AlertDialogPrimitive.Trigger

export interface ConfirmDialogContentProps {
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** Set false when the caller renders its own submit control. */
  showActions?: boolean
  onConfirm: () => void
  className?: string
  /** Optional form or detail content shown between the copy and the actions. */
  children?: ReactNode
}

/**
 * Every destructive action in the app routes through this so a mis-tap can
 * never delete a day's work silently.
 */
export function ConfirmDialogContent({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  showActions = true,
  onConfirm,
  className,
  children,
}: ConfirmDialogContentProps) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-60 bg-[var(--overlay)] backdrop-blur-[2px]" />
      <AlertDialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-60 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto',
          'rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_24px_60px_-24px_rgb(55_49_61_/_0.35)]',
          'data-[state=open]:animate-[pop_0.2s_cubic-bezier(0.34,1.56,0.64,1)]',
          className,
        )}
      >
        <div className="flex gap-3">
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-2xl',
              destructive
                ? 'bg-[var(--color-blush)] text-[var(--color-rose-deep)]'
                : 'bg-[var(--accent-soft)] text-[var(--accent-ink)]',
            )}
          >
            <AlertTriangle className="size-5" />
          </span>
          <div className="min-w-0">
            <AlertDialogPrimitive.Title className="font-display text-sm font-bold text-[var(--fg)]">
              {title}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
              {description}
            </AlertDialogPrimitive.Description>
          </div>
        </div>

        {children ? <div className="mt-4">{children}</div> : null}

        {showActions ? (
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="ghost" size="sm">
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button
                variant={destructive ? 'destructive' : 'default'}
                size="sm"
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        ) : null}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  )
}

export function ActionButton(props: ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger {...props} />
}
