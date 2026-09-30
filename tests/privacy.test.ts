import { describe, it, expect } from 'vitest';
import { resolveProfilePhone, ContactRecord } from '../src/lib/privacy/phone';

describe('Player Phone Privacy & Security', () => {
  const contactHidden: ContactRecord = {
    playerId: 'user-123',
    phone: '+15551234567',
    showPhone: false,
  };

  const contactPublic: ContactRecord = {
    playerId: 'user-123',
    phone: '+15551234567',
    showPhone: true,
  };

  it('NEVER returns a hidden phone number to other authenticated users', () => {
    const viewerOtherUser = {
      currentUserId: 'other-user-999',
      isAuthenticated: true,
    };

    const resolved = resolveProfilePhone(contactHidden, viewerOtherUser);

    expect(resolved.phone).toBeNull();
    expect(resolved.showPhone).toBe(false);
  });

  it('NEVER returns any phone number to unauthenticated / public viewers', () => {
    const viewerGuest = {
      currentUserId: null,
      isAuthenticated: false,
    };

    // Even if showPhone is true, guests receive null
    const resolvedPublic = resolveProfilePhone(contactPublic, viewerGuest);
    expect(resolvedPublic.phone).toBeNull();
    expect(resolvedPublic.showPhone).toBe(false);

    // And if showPhone is false, guests receive null
    const resolvedHidden = resolveProfilePhone(contactHidden, viewerGuest);
    expect(resolvedHidden.phone).toBeNull();
    expect(resolvedHidden.showPhone).toBe(false);
  });

  it('returns the phone number to the profile owner themselves even when hidden', () => {
    const viewerOwner = {
      currentUserId: 'user-123',
      isAuthenticated: true,
    };

    const resolved = resolveProfilePhone(contactHidden, viewerOwner);

    expect(resolved.phone).toBe('+15551234567');
    expect(resolved.showPhone).toBe(false);
  });

  it('returns the phone number to other logged-in users ONLY when show_phone is enabled', () => {
    const viewerOtherUser = {
      currentUserId: 'other-user-999',
      isAuthenticated: true,
    };

    const resolved = resolveProfilePhone(contactPublic, viewerOtherUser);

    expect(resolved.phone).toBe('+15551234567');
    expect(resolved.showPhone).toBe(true);
  });
});
