import type { SettingsValues } from "@/types/settings";

export type NotificationKey = "interviewReminders" | "weeklyDigest";

export const NOTIFICATION_PREFS: {
  key: NotificationKey;
  title: string;
  description: string;
}[] = [
  {
    key: "interviewReminders",
    title: "Interview Reminders",
    description: "Receive email alerts 24 hours and 1 hour before scheduled mocks",
  },
  {
    key: "weeklyDigest",
    title: "Weekly Digest",
    description: "Summary of practice performance, metrics, and suggested topics",
  },
];

// Compile-time check that every pref key is a boolean setting.
type _Check = Record<NotificationKey, boolean> extends Pick<SettingsValues, NotificationKey>
  ? true
  : never;
