"use client";

// The target job form with the interview insights panel below it (Issues #09
// and #16). Saving or removing the job reloads the insights; a failure in the
// insights panel leaves the form untouched.

import { useState } from "react";
import { InterviewInsightsPanel } from "@/components/insights/InterviewInsightsPanel";
import { TargetJobForm } from "./TargetJobForm";
import type { TargetJob, TargetJobAction } from "@/lib/target-job/target-job-form-state";

interface TargetJobWorkspaceProps {
  saveAction: TargetJobAction;
  removeAction: TargetJobAction;
  initialTargetJob: TargetJob | null;
  loadError?: string;
}

export function TargetJobWorkspace(props: TargetJobWorkspaceProps) {
  const [insightsKey, setInsightsKey] = useState(0);

  return (
    <div className="flex flex-col gap-8">
      <TargetJobForm {...props} onTargetJobChange={() => setInsightsKey((key) => key + 1)} />
      <InterviewInsightsPanel refreshKey={insightsKey} />
    </div>
  );
}
