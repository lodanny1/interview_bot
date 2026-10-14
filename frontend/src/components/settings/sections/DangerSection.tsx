import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SettingRow } from "../SettingRow";
import { SettingsCard } from "../SettingsCard";

interface Props {
  /** Called only after the user confirms. */
  onDeleteConfirmed: () => void;
}

export function DangerSection({ onDeleteConfirmed }: Props) {
  function handleClick() {
    // Placeholder confirmation. Swap for your dialog component when you have one.
    if (window.confirm("Delete your account? This cannot be undone."))
      onDeleteConfirmed();
  }

  return (
    <SettingsCard
      icon={TriangleAlert}
      tone="danger"
      title="Delete Account"
      description="Permanently remove your platform profile and data"
    >
      <SettingRow
        filled
        description="Permanently remove your profile, interview history, and calendar connections. This action cannot be undone."
        control={
          <Button variant="danger" size="sm" onClick={handleClick}>
            Delete Account
          </Button>
        }
      />
    </SettingsCard>
  );
}
