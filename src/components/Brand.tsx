import Link from 'next/link';

export function StrivoMark({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="15" fill="#C6FF3D" />
      <path d="M33 12H22L12 25h13l-9 11h11l10-13H24l9-11Z" fill="#0B1020" />
    </svg>
  );
}

export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="Strivo home" className="brand-link flex items-center gap-3 w-fit">
      <StrivoMark className={compact ? 'h-9 w-9 shrink-0' : 'h-11 w-11 shrink-0'} />
      <div>
        <span className="block text-2xl font-extrabold tracking-[-0.06em] leading-none text-[var(--text-main)]">strivo<span className="text-[var(--accent-ink)]">.</span></span>
        {!compact && <span className="block mt-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">Play. Compete. Rise.</span>}
      </div>
    </Link>
  );
}
