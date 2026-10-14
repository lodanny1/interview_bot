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

export function SettingsForm({
  initialValues,
  plan,
}: Props) {
  const [saved, setSaved] =
    useState<SettingsValues>(initialValues);

  const [values, setValues] =
    useState<SettingsValues>(initialValues);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onChange: SettingChangeHandler = (key, value) => {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));

    setMessage(null);
  };

  const dirty =
    JSON.stringify(values) !== JSON.stringify(saved);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: values.fullName,
          role: values.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save settings"
        );
      }

      setSaved(values);
      setMessage("Settings saved.");
    } catch (error) {
      console.error("Failed to save settings:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setValues(saved);
    setMessage(null);
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
          <Button
            variant="soft"
            onClick={handleDiscard}
            disabled={!dirty || saving}
          >
            Discard
          </Button>

          <Button
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            <Check className="size-4" aria-hidden />

            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {message && (
        <p className="text-sm text-secondary">
          {message}
        </p>
      )}

      <ProfileSection
        values={values}
        onChange={onChange}
      />

      <CalendarSection
        values={values}
        onChange={onChange}
      />

      <NotificationsSection
        values={values}
        onChange={onChange}
      />

      <SubscriptionSection plan={plan} />

      <DangerSection
        onDeleteConfirmed={() => {
          // Account deletion can be implemented later.
        }}
      />
    </div>
  );
}