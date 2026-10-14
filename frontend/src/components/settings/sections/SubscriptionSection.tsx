import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SettingRow } from "../SettingRow";
import { SettingsCard } from "../SettingsCard";
import type { Plan } from "@/types/settings";

interface Props {
  plan: Plan;
  /** Where "Manage Plan" goes. Point at your billing page or portal. */
  manageHref?: string;
}

export function SubscriptionSection({ plan, manageHref = "/billing" }: Props) {
  return (
    <SettingsCard
      icon={CreditCard}
      title="Subscription & Plan"
      description="Manage billing cycle and subscription features"
      headerEnd={<Badge>{plan.status}</Badge>}
    >
      <SettingRow
        filled
        title={`${plan.name} (${plan.price})`}
        control={
          // A link styled like the soft Button: navigation should be an <a>, not a <button>.
          <Link
            href={manageHref}
            className="inline-flex h-9 items-center rounded-lg bg-tinted px-4 text-sm font-semibold text-secondary transition-colors hover:bg-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Manage Plan
          </Link>
        }
      />
    </SettingsCard>
  );
}
