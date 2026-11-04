import type { Metadata } from "next";
import { TargetJobsManager } from "@/components/target-job/TargetJobsManager";

export const metadata: Metadata = {
  title: "Target Jobs - Phyyve",
};

export default function TargetJobPage() {
  return (
    <div className="w-full max-w-3xl p-10">
      <header className="mb-8">
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-primary">
          Target Jobs
        </h1>

        <p className="text-lg text-tertiary">
          Save multiple jobs you are preparing for. You can select one when starting an interview.
        </p>
      </header>

      <TargetJobsManager />
    </div>
  );
}
