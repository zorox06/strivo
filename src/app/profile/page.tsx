'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProfileView from '@/components/ProfileView';

export default function MyProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="space-y-4 py-8">
        <div className="h-44 court-card skeleton-box" />
        <div className="h-32 court-card skeleton-box" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <ProfileView />;
}
