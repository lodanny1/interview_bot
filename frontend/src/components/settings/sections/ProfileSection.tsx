import { Camera, User } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SettingsCard } from "../SettingsCard";
import type { SettingChangeHandler, SettingsValues } from "@/types/settings";

interface Props {
  values: SettingsValues;
  onChange: SettingChangeHandler;
  onChangePhoto?: () => void;
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function ProfileSection({ values, onChange, onChangePhoto }: Props) {
  return (
    <SettingsCard
      icon={User}
      title="Profile"
      description="Your personal information and platform role"
    >
      <div className="flex items-center gap-4">
        <Avatar
          initials={initialsOf(values.fullName)}
          size="lg"
          badge={<Camera className="size-3" aria-hidden />}
        />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[15px] font-bold text-primary">
            {values.fullName}
            <Badge>Pro</Badge>
          </p>
          <p className="text-[13px] text-secondary">{values.email}</p>
        </div>
        <Button
          variant="soft"
          size="sm"
          className="ml-auto"
          onClick={onChangePhoto}
        >
          Change Photo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Full Name"
          value={values.fullName}
          onChange={(v) => onChange("fullName", v)}
          autoComplete="name"
        />
        <TextField
          label="Email Address"
          type="email"
          value={values.email}
          onChange={(v) => onChange("email", v)}
          autoComplete="email"
        />
        <TextField
          label="Role"
          value={values.role}
          onChange={(v) => onChange("role", v)}
          className="sm:col-span-2"
        />
      </div>
    </SettingsCard>
  );
}
