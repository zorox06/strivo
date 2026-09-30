export default function Loading() {
  return <div role="status" className="space-y-5"><span className="sr-only">Loading Strivo</span><div className="skeleton-box h-8 w-48" /><div className="grid md:grid-cols-2 gap-5"><div className="skeleton-box h-80" /><div className="space-y-4"><div className="skeleton-box h-32" /><div className="skeleton-box h-32" /></div></div></div>;
}
