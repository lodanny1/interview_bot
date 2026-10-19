import { mockUsers } from "./mock-users";
import type { AppUser } from "./types";

// Temporary development session.
// This will later be replaced with the authenticated Cognito user.
export function getCurrentUser(): AppUser | null {
  return mockUsers.approvedFreeUser;
}