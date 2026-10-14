import { cn } from '@/lib/utils'

/** The app mark: a small pastel cat wearing a planner checklist. */
export function Logo({ className, animated = true }: { className?: string; animated?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('shrink-0', animated && 'animate-float', className)}
      role="img"
      aria-label="Anusree's Daily Tracker logo"
    >
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F8C8DC" />
          <stop offset="100%" stopColor="#E8DDF8" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="14" fill="url(#logo-bg)" />
      <path d="M15 17l-2-9 8 4z" fill="#FFFFFF" stroke="#B95F86" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M33 17l2-9-8 4z" fill="#FFFFFF" stroke="#B95F86" strokeWidth="1.4" strokeLinejoin="round" />
      <path
        d="M24 14c7.6 0 13 5 13 11.6S31.6 38 24 38s-13-5.8-13-12.4S16.4 14 24 14z"
        fill="#FFFFFF"
        stroke="#B95F86"
        strokeWidth="1.4"
      />
      <circle cx="19.5" cy="25" r="1.7" fill="#37313D" />
      <circle cx="28.5" cy="25" r="1.7" fill="#37313D" />
      <path d="M22.6 29.4c0 .9.6 1.4 1.4 1.4s1.4-.5 1.4-1.4" stroke="#37313D" strokeWidth="1.1" strokeLinecap="round" />
      <ellipse cx="14.5" cy="28.5" rx="2.6" ry="1.7" fill="#F8C8DC" />
      <ellipse cx="33.5" cy="28.5" rx="2.6" ry="1.7" fill="#F8C8DC" />
      <path d="M20 12.5l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="#F3D27A" opacity="0.9" />
    </svg>
  )
}
