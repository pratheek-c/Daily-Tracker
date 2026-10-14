import { cn } from '@/lib/utils'

export type MascotKind =
  | 'cat'
  | 'bunny'
  | 'sleeping-cat'
  | 'sleeping-bunny'
  | 'cat-box'
  | 'cat-crown'
  | 'bunny-crown'

interface MascotProps {
  kind: MascotKind
  className?: string
  /** Adds the gentle float animation. */
  animate?: boolean
  title?: string
}

/**
 * Hand-built vector mascots.
 *
 * They are inline SVG rather than raster art so they stay crisp at every size,
 * inherit the pastel palette from CSS variables, and add nothing to the
 * network waterfall.
 */
export function Mascot({ kind, className, animate = false, title }: MascotProps) {
  const label = title ?? MASCOT_LABELS[kind]
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={label}
      className={cn('select-none', animate && 'animate-float', className)}
      fill="none"
    >
      <title>{label}</title>
      {kind === 'cat' ? <Cat /> : null}
      {kind === 'bunny' ? <Bunny /> : null}
      {kind === 'sleeping-cat' ? <SleepingCat /> : null}
      {kind === 'sleeping-bunny' ? <SleepingBunny /> : null}
      {kind === 'cat-box' ? <CatBox /> : null}
      {kind === 'cat-crown' ? <CrownedCat /> : null}
      {kind === 'bunny-crown' ? <CrownedBunny /> : null}
    </svg>
  )
}

const MASCOT_LABELS: Record<MascotKind, string> = {
  cat: 'A small white cat, the study mascot',
  bunny: 'A small white bunny, the habit mascot',
  'sleeping-cat': 'A sleeping cat for bedtime',
  'sleeping-bunny': 'A sleeping bunny for bedtime',
  'cat-box': 'A cat peeking out of a box',
  'cat-crown': 'A cat wearing a crown',
  'bunny-crown': 'A bunny wearing a crown',
}

/* -------------------------------------------------------------------------- */
/* Shared parts                                                               */
/* -------------------------------------------------------------------------- */

function Face({ y = 0, blush = '#F8C8DC', eyeStyle = 'round' }: { y?: number; blush?: string; eyeStyle?: 'round' | 'happy' | 'closed' | 'sleep' }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <ellipse cx="44" cy="70" rx="7" ry="4.4" fill={blush} opacity="0.75" />
      <ellipse cx="76" cy="70" rx="7" ry="4.4" fill={blush} opacity="0.75" />
      {eyeStyle === 'round' ? (
        <>
          <ellipse cx="50" cy="61" rx="3" ry="3.6" fill="#37313D" />
          <ellipse cx="70" cy="61" rx="3" ry="3.6" fill="#37313D" />
          <circle cx="51" cy="59.6" r="1.1" fill="#FFFFFF" />
          <circle cx="71" cy="59.6" r="1.1" fill="#FFFFFF" />
        </>
      ) : null}
      {eyeStyle === 'happy' ? (
        <>
          <path d="M46.5 62c1.6-2.4 4.9-2.4 6.5 0" stroke="#37313D" strokeWidth="2" strokeLinecap="round" />
          <path d="M67 62c1.6-2.4 4.9-2.4 6.5 0" stroke="#37313D" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : null}
      {eyeStyle === 'closed' ? (
        <>
          <path d="M46.5 62c1.8 1.8 4.7 1.8 6.5 0" stroke="#37313D" strokeWidth="2" strokeLinecap="round" />
          <path d="M67 62c1.8 1.8 4.7 1.8 6.5 0" stroke="#37313D" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : null}
      {eyeStyle === 'sleep' ? (
        <>
          <path d="M46.5 62c1.8 1.8 4.7 1.8 6.5 0" stroke="#37313D" strokeWidth="2" strokeLinecap="round" />
          <path d="M67 62c1.8 1.8 4.7 1.8 6.5 0" stroke="#37313D" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : null}
    </g>
  )
}

function CatMouth() {
  return (
    <path
      d="M57.4 68.5c0 1.6 1.2 2.6 2.6 2.6s2.6-1 2.6-2.6"
      stroke="#37313D"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  )
}

function Whiskers() {
  return (
    <g stroke="#37313D" strokeWidth="1.3" strokeLinecap="round" opacity="0.55">
      <path d="M40 62.5 30 60.5" />
      <path d="M40 66.5 30.5 67" />
      <path d="M80 62.5 90 60.5" />
      <path d="M80 66.5 89.5 67" />
    </g>
  )
}

function Sparkles() {
  return (
    <g fill="#E9BD75" opacity="0.9">
      <path d="M18 30l1.8 4.4L24 36l-4.2 1.6L18 42l-1.8-4.4L12 36l4.2-1.6z" />
      <path d="M100 24l1.3 3.2 3.2 1.3-3.2 1.3L100 33l-1.3-3.2-3.2-1.3 3.2-1.3z" opacity="0.7" />
    </g>
  )
}

function Crown({ y = 0 }: { y?: number }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <path
        d="M48 34l5-9 6 6.5L60 22l1 9.5 6-6.5 5 9z"
        fill="#F3D27A"
        stroke="#D9AE4E"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="24" r="1.6" fill="#F2A7C3" />
    </g>
  )
}

/* -------------------------------------------------------------------------- */
/* Mascots                                                                    */
/* -------------------------------------------------------------------------- */

function Cat() {
  return (
    <g>
      <path d="M36 40l-4-18 16 8z" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M84 40l4-18-16 8z" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M39.5 36.5l-2-9 7.5 4z" fill="#F8C8DC" />
      <path d="M80.5 36.5l2-9-7.5 4z" fill="#F8C8DC" />
      <path
        d="M60 34c14.4 0 25 9.6 25 22.5S74 80 60 80 35 69.4 35 56.5 45.6 34 60 34z"
        fill="#FFFFFF"
        stroke="#E8DDF8"
        strokeWidth="2.4"
      />
      <Face eyeStyle="round" />
      <CatMouth />
      <Whiskers />
      <g stroke="#F2A7C3" strokeWidth="1.6" strokeLinecap="round" opacity="0.8">
        <path d="M30 52c-6-2-9-6-9-6" />
        <path d="M90 52c6-2 9-6 9-6" />
      </g>
      <Sparkles />
    </g>
  )
}

function Bunny() {
  return (
    <g>
      <ellipse cx="48" cy="30" rx="7" ry="19" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" transform="rotate(-8 48 30)" />
      <ellipse cx="72" cy="30" rx="7" ry="19" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" transform="rotate(8 72 30)" />
      <ellipse cx="48" cy="30" rx="3.2" ry="13" fill="#FBE2EE" transform="rotate(-8 48 30)" />
      <ellipse cx="72" cy="30" rx="3.2" ry="13" fill="#FBE2EE" transform="rotate(8 72 30)" />
      <path
        d="M60 46c14 0 24 9.4 24 21.5S74 89 60 89 36 79.5 36 67.5 46 46 60 46z"
        fill="#FFFFFF"
        stroke="#E8DDF8"
        strokeWidth="2.4"
      />
      <Face y={8} eyeStyle="round" />
      <path
        d="M60 74c1.6 0 2.4 1 2.4 2s-1.2 2.4-2.4 3.4c-1.2-1-2.4-2.4-2.4-3.4s.8-2 2.4-2z"
        fill="#F2A7C3"
      />
      <Sparkles />
    </g>
  )
}

function SleepingCat() {
  return (
    <g>
      <ellipse cx="60" cy="82" rx="34" ry="9" fill="#E8DDF8" opacity="0.5" />
      <path
        d="M60 42c13.8 0 24 9.2 24 21.6S73.8 85 60 85 36 76 36 63.6 46.2 42 60 42z"
        fill="#FFFFFF"
        stroke="#E8DDF8"
        strokeWidth="2.4"
      />
      <path d="M38 48l-3-15 13 6z" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M82 48l3-15-13 6z" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" strokeLinejoin="round" />
      <Face y={6} eyeStyle="closed" />
      <CatMouth />
      <g fill="#89818F" opacity="0.7">
        <circle cx="88" cy="34" r="2.4" />
        <circle cx="97" cy="26" r="3.4" />
        <circle cx="107" cy="16" r="4.4" />
      </g>
      <path d="M24 34c2.6-2.6 5.4-2 6 0s-2 4-6 0z" fill="#F2A7C3" opacity="0.6" />
    </g>
  )
}

function SleepingBunny() {
  return (
    <g>
      <ellipse cx="60" cy="84" rx="33" ry="9" fill="#E8DDF8" opacity="0.5" />
      <ellipse cx="50" cy="40" rx="6" ry="16" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" transform="rotate(-14 50 40)" />
      <ellipse cx="70" cy="40" rx="6" ry="16" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" transform="rotate(14 70 40)" />
      <ellipse cx="50" cy="40" rx="2.6" ry="10" fill="#FBE2EE" transform="rotate(-14 50 40)" />
      <ellipse cx="70" cy="40" rx="2.6" ry="10" fill="#FBE2EE" transform="rotate(14 70 40)" />
      <path
        d="M60 52c13.4 0 23 8.8 23 20.4S73.4 87 60 87 37 83 37 72.4 46.6 52 60 52z"
        fill="#FFFFFF"
        stroke="#E8DDF8"
        strokeWidth="2.4"
      />
      <Face y={12} eyeStyle="sleep" />
      <path d="M60 80c1.5 0 2.3 1 2.3 1.9s-1.1 2.3-2.3 3.2c-1.2-.9-2.3-2.3-2.3-3.2s.8-1.9 2.3-1.9z" fill="#F2A7C3" />
      <g fill="#89818F" opacity="0.65">
        <circle cx="90" cy="40" r="2.2" />
        <circle cx="99" cy="32" r="3.2" />
        <circle cx="108" cy="22" r="4.2" />
      </g>
    </g>
  )
}

function CatBox() {
  return (
    <g>
      <path d="M40 46l-4-16 14 7z" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M80 46l4-16-14 7z" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" strokeLinejoin="round" />
      <path
        d="M60 40c12.8 0 22 8.6 22 20v10H38V60c0-11.4 9.2-20 22-20z"
        fill="#FFFFFF"
        stroke="#E8DDF8"
        strokeWidth="2.4"
      />
      <Face y={-2} eyeStyle="happy" />
      <CatMouth />
      <path d="M26 70h68l-5 30H31z" fill="#F5EBE0" stroke="#E4D4C4" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M26 70l14-12 20 8 20-8 14 12z" fill="#EEDFD2" stroke="#E4D4C4" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M31 84h58" stroke="#E4D4C4" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="44" cy="63" rx="6" ry="3.6" fill="#F8C8DC" opacity="0.8" />
      <ellipse cx="76" cy="63" rx="6" ry="3.6" fill="#F8C8DC" opacity="0.8" />
    </g>
  )
}

function CrownedCat() {
  return (
    <g>
      <Crown y={-2} />
      <path d="M38 48l-4-17 15 8z" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M82 48l4-17-15 8z" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" strokeLinejoin="round" />
      <path
        d="M60 40c14 0 24 9.4 24 22S74 86 60 86 36 74.4 36 62 46 40 60 40z"
        fill="#FFFFFF"
        stroke="#E8DDF8"
        strokeWidth="2.4"
      />
      <Face y={4} eyeStyle="happy" />
      <CatMouth />
      <Whiskers />
      <Sparkles />
    </g>
  )
}

function CrownedBunny() {
  return (
    <g>
      <Crown y={-4} />
      <ellipse cx="49" cy="34" rx="6.6" ry="17" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" transform="rotate(-8 49 34)" />
      <ellipse cx="71" cy="34" rx="6.6" ry="17" fill="#FFFFFF" stroke="#E8DDF8" strokeWidth="2.4" transform="rotate(8 71 34)" />
      <path
        d="M60 50c13.6 0 23.5 9 23.5 21S73.6 91 60 91 36.5 83 36.5 71 46.4 50 60 50z"
        fill="#FFFFFF"
        stroke="#E8DDF8"
        strokeWidth="2.4"
      />
      <Face y={10} eyeStyle="happy" />
      <path d="M60 78c1.6 0 2.4 1 2.4 2s-1.2 2.4-2.4 3.4c-1.2-1-2.4-2.4-2.4-3.4s.8-2 2.4-2z" fill="#F2A7C3" />
      <Sparkles />
    </g>
  )
}

/* -------------------------------------------------------------------------- */
/* Tiny decorative marks                                                      */
/* -------------------------------------------------------------------------- */

export type DecorationKind = 'star' | 'heart' | 'flower' | 'cloud' | 'paw' | 'ribbon' | 'sparkle'

export function Decoration({
  kind,
  className,
  style,
}: {
  kind: DecorationKind
  className?: string
  style?: React.CSSProperties
}) {
  const common = { className: cn('shrink-0', className), style, viewBox: '0 0 24 24', 'aria-hidden': true }
  switch (kind) {
    case 'star':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2.6l2.7 6 6.5.6-4.9 4.3 1.4 6.4L12 16.6l-5.7 3.3 1.4-6.4L2.8 9.2l6.5-.6z" />
        </svg>
      )
    case 'heart':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 20.4l-1.4-1.3C5.5 14.6 2.5 11.9 2.5 8.6 2.5 5.9 4.6 4 7.2 4c1.5 0 3 .7 3.9 1.9l.9 1 .9-1C13.8 4.7 15.3 4 16.8 4 19.4 4 21.5 5.9 21.5 8.6c0 3.3-3 6-8.1 10.5z" />
        </svg>
      )
    case 'flower':
      return (
        <svg {...common} fill="currentColor">
          <circle cx="12" cy="6" r="4" />
          <circle cx="12" cy="18" r="4" />
          <circle cx="6" cy="12" r="4" />
          <circle cx="18" cy="12" r="4" />
          <circle cx="12" cy="12" r="2.4" fill="#F3D27A" />
        </svg>
      )
    case 'cloud':
      return (
        <svg {...common} fill="currentColor">
          <path d="M7 18a4.5 4.5 0 01-.4-9A6 6 0 0118 8.6 4.2 4.2 0 0117.5 18z" />
        </svg>
      )
    case 'paw':
      return (
        <svg {...common} fill="currentColor">
          <ellipse cx="8" cy="8.4" rx="2.4" ry="3" />
          <ellipse cx="16" cy="8.4" rx="2.4" ry="3" />
          <ellipse cx="4.6" cy="13.4" rx="2.2" ry="2.6" />
          <ellipse cx="19.4" cy="13.4" rx="2.2" ry="2.6" />
          <path d="M12 12.4c3.2 0 5.6 2.6 5.6 5.2S15.2 21 12 21s-5.6-1.2-5.6-3.4 2.4-5.2 5.6-5.2z" />
        </svg>
      )
    case 'ribbon':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 12.6l-4.6-4.2a3 3 0 114.6-3.6 3 3 0 114.6 3.6z" />
          <path d="M12 12.6l-3.4 7.2 3.4-2 3.4 2-3.4-7.2z" opacity="0.7" />
        </svg>
      )
    case 'sparkle':
    default:
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
        </svg>
      )
  }
}
