import { Calendar, CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { SettingRow } from "../SettingRow";
import { SettingsCard } from "../SettingsCard";
import type { SettingChangeHandler, SettingsValues } from "@/types/settings";

interface Props {
  values: SettingsValues;
  onChange: SettingChangeHandler;
}

export function CalendarSection({ values, onChange }: Props) {
  return (
    <SettingsCard
      icon={Calendar}
      title="Connected Calendar"
      description="Sync interview invites and mock sessions"
      headerEnd={<Badge>Connected</Badge>}
    >
      <SettingRow
        filled
        leading={<CalendarCheck className="size-5" aria-hidden />}
        title="Google Calendar"
        description={values.email}
        control={
          <Toggle
            label="Google Calendar sync"
            checked={values.googleCalendar}
            onChange={(v) => onChange("googleCalendar", v)}
          />
        }
      />
    </SettingsCard>
  );
}
