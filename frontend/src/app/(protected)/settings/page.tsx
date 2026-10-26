import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SettingsForm } from "@/components/settings/SettingsForm";
import type { Plan, SettingsValues } from "@/types/settings";
import { mockMeResponse } from "@/mocks/mock-auth-user";

type MeResponse = {
  user: {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    account_status: string;
    access_tier: string;
  };

  profile: {
    user_id: string;
    target_role: string | null;
    target_company: string | null;
    experience_level: string | null;
    focus_areas: string | null;
    bio: string | null;
    updated_at: string;
  } | null;
};

const useMockData = process.env.USE_MOCK_DATA === "true";

async function getSettingsData(): Promise<MeResponse> {
  if (useMockData) {
    return {
      ...mockMeResponse,
      profile: {
        user_id: mockMeResponse.user.id,
        target_role: "Software Engineer",
        target_company: "Example Company",
        experience_level: "Entry Level",
        focus_areas: "Cloud, AI, Backend",
        bio: "Mock profile for frontend development.",
        updated_at: new Date().toISOString(),
      },
    };
  }

  const cookieStore = await cookies();
  const idToken = cookieStore.get("ib_session")?.value;

  if (!idToken) {
    redirect("/login");
  }

  const backendUrl = process.env.BACKEND_URL;

  if (!backendUrl) {
    throw new Error("BACKEND_URL is not configured.");
  }

  const response = await fetch(`${backendUrl}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    redirect("/login");
  }

  if (!response.ok) {
    throw new Error(
      `Unable to load settings: ${response.status}`
    );
  }

  return (await response.json()) as MeResponse;
}

export default async function SettingsPage() {
  const { user, profile } = await getSettingsData();

  const initialValues: SettingsValues = {
    fullName:
      user.display_name ??
      user.email.split("@")[0],

    email: user.email,

    role: profile?.target_role ?? "",

    googleCalendar: false,
    interviewReminders: false,
    weeklyDigest: false,
  };

  const plan: Plan =
    user.access_tier === "PREMIUM"
      ? {
          name: "Premium",
          price: "Premium plan",
          status: "Active",
        }
      : {
          name: "Basic",
          price: "Free",
          status: "Active",
        };

  return (
    <SettingsForm
      initialValues={initialValues}
      plan={plan}
    />
  );
}
