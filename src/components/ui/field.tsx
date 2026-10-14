import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const baseField =
  'w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] shadow-[inset_0_1px_2px_rgb(55_49_61_/_0.03)] transition-colors placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(baseField, 'h-9.5', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(baseField, 'min-h-20 resize-y leading-relaxed', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        baseField,
        "h-9.5 cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2389818F%22 stroke-width=%222%22 stroke-linecap=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 block text-xs font-semibold tracking-wide text-[var(--fg-muted)]', className)}
      {...props}
    >
      {children}
    </label>
  )
}

export interface FieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
  htmlFor?: string
}

export function Field({ label, hint, error, required, children, className, htmlFor }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <Label htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-0.5 text-[var(--accent-ink)]">*</span> : null}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-[#C2545F]">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[var(--fg-subtle)]">{hint}</p>
      ) : null}
    </div>
  )
}
