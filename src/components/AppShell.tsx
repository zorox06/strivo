'use client';

import { usePathname } from 'next/navigation';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname === '/login' || pathname === '/onboarding';

  return (
    <main id="main-content" tabIndex={-1} className={`app-main flex-1 w-full mx-auto px-4 md:px-6 py-6 md:py-9 ${isAuth ? 'max-w-3xl' : 'max-w-[1440px] lg:pl-72 lg:pr-9 pb-32 lg:pb-12'}`}>
      <div key={pathname} className="page-enter">{children}</div>
    </main>
  );
}
