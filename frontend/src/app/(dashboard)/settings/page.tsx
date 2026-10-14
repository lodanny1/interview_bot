import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { mockPlan, mockSettings } from "@/lib/mock-settings";

export const metadata: Metadata = { title: "Settings" };

// Server component, like the dashboard. Fetch real user + plan data here later
// and pass it down; the interactive form lives in <SettingsForm>.
export default function SettingsPage() {
  return <SettingsForm initialValues={mockSettings} plan={mockPlan} />;
}
