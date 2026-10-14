export interface SettingsValues {
  fullName: string;
  email: string;
  role: string;
  googleCalendar: boolean;
  interviewReminders: boolean;
  weeklyDigest: boolean;
}

export type SettingChangeHandler = <K extends keyof SettingsValues>(
  key: K,
  value: SettingsValues[K],
) => void;

export interface Plan {
  name: string;
  price: string;
  status: string;
}
