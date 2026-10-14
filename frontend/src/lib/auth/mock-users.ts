//temporary test users for authentication and access=control development

import type { AppUser } from "./types";

export const mockUsers: Record<string, AppUser> = {
  pendingUser: {
    id: "user-1",
    cognitoId: "cognito-pending-1",
    name: "Pending User",
    email: "pending@example.com",
    status: "pending",
    tier: "free",
    role: "user",
  },

  approvedFreeUser: {
    id: "user-2",
    cognitoId: "cognito-approved-free-1",
    name: "Free User",
    email: "free@example.com",
    status: "approved",
    tier: "free",
    role: "user",
  },

  approvedPremiumUser: {
    id: "user-3",
    cognitoId: "cognito-approved-premium-1",
    name: "Premium User",
    email: "premium@example.com",
    status: "approved",
    tier: "premium",
    role: "user",
  },

  adminUser: {
    id: "user-4",
    cognitoId: "cognito-admin-1",
    name: "Admin User",
    email: "admin@example.com",
    status: "approved",
    tier: "premium",
    role: "admin",
  },

  rejectedUser: {
    id: "user-5",
    cognitoId: "cognito-rejected-1",
    name: "Rejected User",
    email: "rejected@example.com",
    status: "rejected",
    tier: "free",
    role: "user",
  },
};
