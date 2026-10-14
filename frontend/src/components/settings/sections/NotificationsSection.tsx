import { Bell } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { NOTIFICATION_PREFS } from "@/lib/settings-config";
import { SettingRow } from "../SettingRow";
import { SettingsCard } from "../SettingsCard";
import type { SettingChangeHandler, SettingsValues } from "@/types/settings";

interface Props {
  values: SettingsValues;
  onChange: SettingChangeHandler;
}

export function NotificationsSection({ values, onChange }: Props) {
  return (
    <SettingsCard
      icon={Bell}
      title="Notifications"
      description="Choose when and how InterviewBot contacts you"
    >
      {NOTIFICATION_PREFS.map((pref) => (
        <SettingRow
          key={pref.key}
          title={pref.title}
          description={pref.description}
          control={
            <Toggle
              label={pref.title}
              checked={values[pref.key]}
              onChange={(v) => onChange(pref.key, v)}
            />
          }
        />
      ))}
    </SettingsCard>
  );
}
