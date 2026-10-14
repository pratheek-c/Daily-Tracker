import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-64 rounded-xl bg-[var(--fg)] px-2.5 py-1.5 text-[0.7rem] leading-snug font-medium text-[var(--surface)]',
          'data-[state=delayed-open]:animate-[pop_0.14s_ease-out]',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}
