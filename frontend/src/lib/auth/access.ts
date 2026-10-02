//Centralized authorization rules for protected features, admin actions, account approval status, and access-tier requirements
import type { AppUser, UserTier } from "./types";

export type AccessState =
  | "unauthenticated"
  | "pending"
  | "rejected"
  | "approved"
  | "admin";

const tierLevel: Record<UserTier, number> = {
  free: 1,
  standard: 2,
  premium: 3,
};

export function getAccessState(user: AppUser | null): AccessState {
  if (!user) {
    return "unauthenticated";
  }

  if (user.status === "pending") {
    return "pending";
  }

  if (user.status === "rejected") {
    return "rejected";
  }

  if (user.role === "admin") {
    return "admin";
  }

  return "approved";
}

export function canAccessProtectedFeatures(user: AppUser | null): boolean {
  return user?.status === "approved";
}

export function canManageUsers(user: AppUser | null): boolean {
  return user?.status === "approved" && user.role === "admin";
}

export function hasRequiredTier(
  user: AppUser | null,
  requiredTier: UserTier
): boolean {
  if (!canAccessProtectedFeatures(user)) {
    return false;
  }

  return tierLevel[user.tier] >= tierLevel[requiredTier];
}