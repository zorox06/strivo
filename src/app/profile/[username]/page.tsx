'use client';

import React, { use } from 'react';
import ProfileView from '@/components/ProfileView';

export default function PlayerProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const resolvedParams = use(params);
  return <ProfileView username={resolvedParams.username} />;
}
