"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProfileSection } from "./sections/ProfileSection";
import { CalendarSection } from "./sections/CalendarSection";
import { NotificationsSection } from "./sections/NotificationsSection";
import { SubscriptionSection } from "./sections/SubscriptionSection";
import { DangerSection } from "./sections/DangerSection";
import type {
  Plan,
  SettingChangeHandler,
  SettingsValues,
} from "../../types/settings";

interface Props {
  initialValues: SettingsValues;
  plan: Plan;
}

export function SettingsForm({ initialValues, plan }: Props) {
  const [saved, setSaved] = useState<SettingsValues>(initialValues);
  const [values, setValues] = useState<SettingsValues>(initialValues);

  const onChange: SettingChangeHandler = (key, value) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  function handleSave() {
    // TODO: persist `values` to your API.
    setSaved(values);
  }

  function handleDiscard() {
    setValues(saved);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Settings
          </h1>
          <p className="text-sm text-secondary">
            Manage your profile, sync calendar, and notification preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="soft" onClick={handleDiscard} disabled={!dirty}>
            Discard
          </Button>
          <Button onClick={handleSave} disabled={!dirty}>
            <Check className="size-4" aria-hidden />
            Save Changes
          </Button>
        </div>
      </div>

      <ProfileSection values={values} onChange={onChange} />
      <CalendarSection values={values} onChange={onChange} />
      <NotificationsSection values={values} onChange={onChange} />
      <SubscriptionSection plan={plan} />
      <DangerSection
        onDeleteConfirmed={() => {
          // TODO: call your delete-account endpoint.
        }}
      />
    </div>
  );
}
