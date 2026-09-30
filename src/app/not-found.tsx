import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
export default function NotFound() {
  return <div className="court-card p-10 text-center space-y-4"><p className="eyebrow">404 · Out of bounds</p><h1 className="text-2xl font-extrabold">This page left the court.</h1><p className="text-sm text-[var(--text-muted)]">Head back to your arena to find tournaments and players.</p><Link href="/" className="btn-lime tap-target px-5 gap-2 text-sm"><ArrowLeft className="w-4 h-4" />Back to Strivo</Link></div>;
}
