'use client';

import Image from 'next/image';

import React from 'react';
import Link from 'next/link';
import { PlusCircle, ArrowRight } from 'lucide-react';

interface CatEmptyStateProps {
  catNumber?: number; // 1 to 12
  title: string;
  message: string;
  actionText?: string;
  actionHref?: string;
  onActionClick?: () => void;
  className?: string;
}

export default function CatEmptyState({
  catNumber = 1,
  title,
  message,
  actionText,
  actionHref,
  onActionClick,
  className = '',
}: CatEmptyStateProps) {
  const catId = `cat-${String(catNumber).padStart(2, '0')}`;

  return (
    <div
      className={`court-card p-8 rounded-3xl text-center flex flex-col items-center justify-center space-y-4 relative overflow-hidden ${className}`}
    >
      {/* Background Court Texture Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white" />
        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white" />
      </div>

      {/* Cat Mascot Illustration with Shuttle Accent */}
      <div className="relative group">
        <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-b from-[var(--surface-raised)] to-[var(--surface)] border-2 border-[var(--hairline)] group-hover:border-[var(--accent-lime)] transition-colors shadow-lg shadow-black/30">
          <Image width={96} height={96}
            src={`/avatars/${catId}.svg`}
            alt="Mascot Cat"
            className="w-full h-full object-cover rounded-full transition-transform group-hover:scale-105 duration-300"
          />
        </div>

        {/* Small Shuttlecock badge floating */}
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--surface-raised)] border border-[var(--accent-lime)] flex items-center justify-center text-[10px] shadow-md">
          🏸
        </div>
      </div>

      {/* Text Copy */}
      <div className="max-w-xs space-y-1 relative z-10">
        <h4 className="font-sport font-extrabold text-lg text-[var(--text-main)] tracking-wide uppercase">
          {title}
        </h4>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          {message}
        </p>
      </div>

      {/* Action Button */}
      {(actionText && (actionHref || onActionClick)) && (
        <div className="pt-2 relative z-10">
          {actionHref ? (
            <Link
              href={actionHref}
              className="tap-target inline-flex items-center gap-2 px-5 py-2.5 rounded-xl btn-lime text-xs font-black shadow-md shadow-[rgba(198,255,61,0.2)] transition-all hover:scale-102"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{actionText}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          ) : (
            <button
              onClick={onActionClick}
              className="tap-target inline-flex items-center gap-2 px-5 py-2.5 rounded-xl btn-lime text-xs font-black shadow-md shadow-[rgba(198,255,61,0.2)] transition-all hover:scale-102"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{actionText}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
