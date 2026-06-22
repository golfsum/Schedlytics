interface LogoProps {
  /** Hide the wordmark, show only the icon */
  iconOnly?: boolean
}

/**
 * Schedlytics brand icon — a navy tile holding a light-blue calendar grid
 * with a gold upward trend arrow (scheduling + growth analytics).
 * Reused by both the sidebar logo and the favicon.
 */
export function BrandIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sl-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22324F" />
          <stop offset="1" stopColor="#15233A" />
        </linearGradient>
        <linearGradient id="sl-cal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CCDDF4" />
          <stop offset="1" stopColor="#9CBDE7" />
        </linearGradient>
        <linearGradient id="sl-arrow" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#D6A73A" />
          <stop offset="1" stopColor="#F1CF7B" />
        </linearGradient>
      </defs>

      {/* navy tile */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#sl-bg)" />

      {/* calendar */}
      <rect x="22" y="13" width="4" height="9" rx="2" fill="#AFCBEC" />
      <rect x="38" y="13" width="4" height="9" rx="2" fill="#AFCBEC" />
      <rect x="15" y="18" width="34" height="31" rx="4" fill="url(#sl-cal)" />
      <g stroke="#6E95CB" strokeLinecap="round">
        <line x1="15.5" y1="27" x2="48.5" y2="27" strokeWidth="1.6" />
        <line x1="26" y1="27" x2="26" y2="49" strokeWidth="1.3" />
        <line x1="37" y1="27" x2="37" y2="49" strokeWidth="1.3" />
        <line x1="15.5" y1="36" x2="48.5" y2="36" strokeWidth="1.3" />
        <line x1="15.5" y1="43" x2="48.5" y2="43" strokeWidth="1.3" />
      </g>

      {/* gold trending arrow */}
      <path
        d="M13 48 L25 40 L32 44 L50 22 M50 22 L42 23 M50 22 L49 31"
        fill="none"
        stroke="url(#sl-arrow)"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Logo({ iconOnly = false }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <BrandIcon className="h-9 w-9 shrink-0 rounded-xl ring-1 ring-white/10 drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]" />
      {!iconOnly && (
        <span className="text-[19px] font-extrabold tracking-tight text-white">
          Sched<span className="text-cyan-accent">lytics</span>
        </span>
      )}
    </div>
  )
}
