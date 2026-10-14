import type { Plan, SettingsValues } from "@/types/settings";

export const mockSettings: SettingsValues = {
  fullName: "Alex Morgan",
  email: "alex.morgan@example.com",
  role: "Senior Frontend Engineer",
  googleCalendar: true,
  interviewReminders: true,
  weeklyDigest: false,
};

export const mockPlan: Plan = {
  name: "Free Starter",
  price: "$0/mo",
  status: "Active",
};
