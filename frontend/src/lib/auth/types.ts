//Shared authentication and authorization types used by issues #44 and #45

export type UserStatus = "pending" | "approved" | "rejected";

export type UserTier = "free" | "standard" | "premium";

export type UserRole = "user" | "admin";

export interface AppUser {
  id: string;
  cognitoId: string;
  name: string;
  email: string;
  status: UserStatus;
  tier: UserTier;
  role: UserRole;
}