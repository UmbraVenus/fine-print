import type { Role } from './types'

const COOKIE = 'fp_role'

// The reviewer is the primary user, so a first visit starts there.
export const DEFAULT_ROLE: Role = 'reviewer'

export function readRole(): Role {
  const match = document.cookie.match(/(?:^|;\s*)fp_role=(reviewer|marketer)/)
  return (match?.[1] as Role | undefined) ?? DEFAULT_ROLE
}

export function writeRole(role: Role): void {
  document.cookie = `${COOKIE}=${role}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}
