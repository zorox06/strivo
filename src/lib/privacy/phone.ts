/**
-- Badminton Phone Privacy Rules & View Resolver
-- Pure TypeScript module modeling database-level RLS & profiles_view logic.
-- Enforces:
-- 1. If viewer is unauthenticated (null), phone is NEVER exposed.
-- 2. If viewer is the owner of the profile, phone is ALWAYS visible to them.
-- 3. If viewer is another authenticated user, phone is visible ONLY IF show_phone === true.
-- 4. If show_phone is false, other users receive null for phone.
*/

export interface ContactRecord {
  playerId: string;
  phone: string | null;
  showPhone: boolean;
}

export interface ViewerContext {
  currentUserId: string | null;
  isAuthenticated: boolean;
}

export interface ResolvedProfileContact {
  phone: string | null;
  showPhone: boolean;
}

/**
 * Resolves the phone number exposed according to database RLS and profiles_view rule:
 * case
 *   when p.id = auth.uid() or (pc.show_phone = true and auth.uid() is not null) then pc.phone
 *   else null
 * end as phone
 */
export function resolveProfilePhone(
  contact: ContactRecord,
  viewer: ViewerContext
): ResolvedProfileContact {
  if (!viewer.isAuthenticated || !viewer.currentUserId) {
    return {
      phone: null,
      showPhone: false,
    };
  }

  const isOwner = viewer.currentUserId === contact.playerId;

  if (isOwner) {
    return {
      phone: contact.phone,
      showPhone: contact.showPhone,
    };
  }

  // Other authenticated user
  if (contact.showPhone) {
    return {
      phone: contact.phone,
      showPhone: true,
    };
  }

  // Hidden phone
  return {
    phone: null,
    showPhone: false,
  };
}
