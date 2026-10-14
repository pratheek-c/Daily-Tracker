/* eslint-disable react-refresh/only-export-components */
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 active:translate-y-px',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_1px_2px_rgb(55_49_61_/_0.06),0_10px_24px_-14px_var(--accent)] hover:brightness-105',
        secondary:
          'bg-[var(--surface-3)] text-[var(--fg)] border border-[var(--line)] hover:bg-[var(--accent-soft)] hover:border-[var(--accent)]',
        outline:
          'border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]',
        ghost: 'text-[var(--fg-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]',
        soft: 'bg-[var(--accent-soft)] text-[var(--accent-ink)] hover:brightness-[0.97]',
        destructive:
          'bg-[#E4757F] text-white hover:bg-[#D9606B] shadow-[0_10px_24px_-16px_#D9606B]',
        success: 'bg-[var(--color-success)] text-white hover:brightness-105',
        link: 'text-[var(--accent-ink)] underline-offset-4 hover:underline rounded-md',
      },
      size: {
        sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
        default: 'h-9.5 px-4 text-sm [&_svg]:size-4',
        lg: 'h-11 px-6 text-sm [&_svg]:size-4.5',
        icon: 'size-9.5 [&_svg]:size-4',
        'icon-sm': 'size-8 [&_svg]:size-3.5',
        'icon-lg': 'size-11 [&_svg]:size-5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return (
    <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
}
