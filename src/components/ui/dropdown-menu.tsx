import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight } from 'lucide-react'
import { useEffect, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { dismissTopOverlay, pushBackHandler } from '@/services/native/back-button'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuSub = DropdownMenuPrimitive.Sub

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  // An open menu should close on the Android hardware back button rather than
  // letting the press fall through to the app.
  useEffect(() => pushBackHandler(() => dismissTopOverlay()), [])

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-44 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5',
          'shadow-[0_20px_48px_-24px_rgb(55_49_61_/_0.4)]',
          'data-[state=open]:animate-[pop_0.16s_ease-out]',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  inset,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'relative flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-[0.8rem] font-medium text-[var(--fg)] outline-none select-none',
        'transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        'data-[highlighted]:bg-[var(--accent-soft)] data-[highlighted]:text-[var(--accent-ink)]',
        '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--fg-muted)] data-[highlighted]:[&_svg]:text-[var(--accent-ink)]',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        'relative flex cursor-pointer items-center gap-2.5 rounded-xl py-2 pr-2.5 pl-8 text-[0.8rem] font-medium outline-none select-none',
        'data-[highlighted]:bg-[var(--accent-soft)] data-[highlighted]:text-[var(--accent-ink)]',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 grid size-3.5 place-items-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-3.5" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        'px-2.5 py-1.5 text-[0.62rem] font-bold tracking-[0.12em] text-[var(--fg-subtle)] uppercase',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('my-1 h-px bg-[var(--line)]', className)}
      {...props}
    />
  )
}

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-[0.8rem] font-medium outline-none',
        'data-[highlighted]:bg-[var(--accent-soft)] data-[state=open]:bg-[var(--accent-soft)]',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-3.5" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

export function DropdownMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        className={cn(
          'z-50 min-w-40 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_20px_48px_-24px_rgb(55_49_61_/_0.4)]',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}
