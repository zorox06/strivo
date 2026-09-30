import { AlertCircle, RotateCcw } from 'lucide-react';

export default function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="court-card p-6 flex flex-wrap items-center gap-4">
      <AlertCircle className="w-6 h-6 text-[var(--color-loss)] shrink-0" />
      <div className="flex-1 min-w-0"><p className="text-sm font-bold">Unable to load this right now</p><p className="text-xs text-[var(--text-muted)] mt-1">{message}</p></div>
      <button type="button" onClick={onRetry} className="btn-secondary tap-target px-4 text-xs gap-2"><RotateCcw className="w-4 h-4" />Try again</button>
    </div>
  );
}
