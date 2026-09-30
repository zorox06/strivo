'use client';

import Image from 'next/image';

import React from 'react';
import Brand from '@/components/Brand';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, BarChart3, User, Settings, PlusCircle, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function Navigation() {
  const pathname = usePathname();
  const { user, profile, hasTournamentAccess, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Hide navigation on onboarding or auth page
  if (pathname === '/login' || pathname === '/onboarding') {
    return null;
  }

  const navItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Tournaments', href: '/tournaments', icon: Trophy },
    { label: 'Leaderboard', href: '/leaderboard', icon: BarChart3 },
    {
      label: 'Profile',
      href: user ? '/profile' : '/login',
      icon: User,
    },
  ];

  if (hasTournamentAccess) {
    navItems.push({
      label: 'Manage',
      href: '/manage',
      icon: Settings,
    });
  }

  const allDesktopNavItems = navItems;

  return (
    <>
      {/* 1. Desktop Left Navigation Rail (Linear / Strava / Chess.com feel on 1280px) */}
      <aside className="hidden lg:flex w-64 fixed left-0 top-0 bottom-0 bg-[var(--surface)] border-r border-[var(--hairline)] flex-col justify-between p-5 z-40 bg-court-texture">
        {/* Top: Logo & Nav Links */}
        <div className="space-y-6">
          {/* Brand Logo */}
          <Brand />

          {/* Organizer Quick Create Action */}
          {profile?.is_admin && (
            <Link
              href="/manage/tournaments/new"
              className="tap-target w-full py-2.5 px-4 rounded-xl btn-lime text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-[rgba(198,255,61,0.2)] transition-all hover:scale-102"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Tournament</span>
            </Link>
          )}

          {/* Navigation Links */}
          <nav aria-label="Main navigation" className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-3 block mb-2">
              Menu
            </span>
            {allDesktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[var(--surface-raised)] text-[var(--accent-ink)] border border-[var(--accent-lime)] font-black shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)]/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  <span className="font-sport uppercase tracking-wide text-sm">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom: Theme Toggle & User Profile Card */}
        <div className="space-y-3 pt-4 border-t border-[var(--hairline)]">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
              <span className="text-[11px] font-semibold">
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </span>
            </div>
            <span className="text-[9px] uppercase font-mono text-[var(--text-muted)]">
              Toggle
            </span>
          </button>

          {/* User Profile Badge */}
          {isLoading ? (
            <div className="h-12 rounded-xl skeleton-box" />
          ) : user && profile ? (
            <Link
              href="/profile"
              className="flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)] hover:border-[var(--accent-lime)] transition-all group"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[var(--accent-lime)] shrink-0">
                <Image width={96} height={96}
                  src={`/avatars/${profile.avatar_id || 'cat-01'}.svg`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-[var(--text-main)] truncate group-hover:text-[var(--accent-ink)] transition-colors">
                  {profile.name}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                  @{profile.username}
                </p>
              </div>
              <div className="font-sport font-black text-sm text-[var(--accent-ink)] tabular-nums">
                {profile.rating}
              </div>
            </Link>
          ) : (
            <Link
              href="/login"
              className="w-full py-2 px-3 rounded-xl btn-lime text-xs font-black text-center block shadow-md shadow-[rgba(198,255,61,0.2)]"
            >
              Sign In
            </Link>
          )}
        </div>
      </aside>

      {/* 2. Mobile / Tablet Top Header (Only on screens < 1024px) */}
      <header className="lg:hidden sticky top-0 z-40 w-full court-motif-header px-4 py-3">
        <div className="max-w-md md:max-w-3xl mx-auto flex items-center justify-between">
          <Brand compact />

          <div className="flex items-center gap-2">
            {/* Theme Toggle (Dark / Light) */}
            <button
              onClick={toggleTheme}
              className="tap-target w-9 h-9 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors flex items-center justify-center"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* Quick Create Tournament for Organizers */}
            {hasTournamentAccess && (
              <Link
                href="/manage/tournaments/new"
                className="tap-target px-3 py-1.5 rounded-xl btn-lime text-xs font-black flex items-center gap-1.5 shadow-md shadow-[rgba(198,255,61,0.2)] transition-all hover:scale-102"
                title="Create Tournament"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">New Tournament</span>
                <span className="sm:hidden font-bold">New</span>
              </Link>
            )}

            {/* User Profile Pill or Sign In */}
            {isLoading ? (
              <div className="w-8 h-8 rounded-full skeleton-box" />
            ) : user && profile ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] hover:border-[var(--accent-lime)] transition-all"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden border border-[var(--accent-lime)]">
                  <Image width={96} height={96}
                    src={`/avatars/${profile.avatar_id || 'cat-01'}.svg`}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="font-sport text-sm font-black text-[var(--accent-ink)] px-1 tabular-nums">
                  {profile.rating}
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="tap-target px-4 py-2 rounded-xl btn-lime text-xs font-black shadow-md shadow-[rgba(198,255,61,0.2)]"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 3. Floating Bottom Navigation Pill (Mobile only < 1024px) */}
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-0 right-0 z-50 flex justify-center px-4 pointer-events-none lg:hidden">
        <nav aria-label="Main navigation" className="pointer-events-auto nav-pill px-3 py-2 w-full max-w-sm flex items-center justify-between">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                className={`tap-target flex-1 flex flex-col items-center justify-center relative py-1 rounded-2xl transition-all ${
                  isActive
                    ? 'text-[var(--accent-ink)] font-extrabold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold'
                }`}
              >
                {isActive && (
                  <span className="absolute -top-1 w-6 h-1 rounded-full bg-[var(--accent-lime)] glow-lime transition-all" />
                )}
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span className="text-[10px] tracking-tight mt-0.5">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
