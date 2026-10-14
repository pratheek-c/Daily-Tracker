import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'scrollbar-none inline-flex items-center gap-1 overflow-x-auto rounded-full border border-[var(--line)] bg-[var(--surface-3)] p-1',
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[var(--fg-muted)] transition-colors',
        'hover:text-[var(--fg)] data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--accent-ink)]',
        'data-[state=active]:shadow-[0_1px_2px_rgb(55_49_61_/_0.06)] [&_svg]:size-3.5',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-4 focus:outline-none', className)} {...props} />
}
