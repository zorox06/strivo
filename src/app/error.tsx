'use client';
import LoadError from '@/components/LoadError';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <LoadError message="Something interrupted this page. Please try again." onRetry={reset} />;
}
