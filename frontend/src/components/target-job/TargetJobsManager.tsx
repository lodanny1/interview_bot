"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { InterviewInsightsPanel } from "@/components/insights/InterviewInsightsPanel";

interface TargetJob {
  id: string;
  job_title: string;
  company: string | null;
  description: string;
  updated_at: string;
}

type JobFields = { jobTitle: string; company: string; description: string };
const blank: JobFields = { jobTitle: "", company: "", description: "" };
const inputClass = "w-full rounded-lg border border-input-default bg-card px-4 py-3";

export function TargetJobsManager() {
  const [jobs, setJobs] = useState<TargetJob[]>([]);
  const [create, setCreate] = useState<JobFields>(blank);
  const [edit, setEdit] = useState<JobFields>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<{ id: string; view: "description" | "insights" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [refresh, setRefresh] = useState<Record<string, number>>({});

  useEffect(() => {
    const controller = new AbortController();
    async function start() {
      try {
        const response = await fetch("/api/target-jobs", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load target jobs");
        if (!controller.signal.aborted) setJobs(Array.isArray(data.targetJobs) ? data.targetJobs : []);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load target jobs");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void start();
    return () => controller.abort();
  }, []);

  async function sendJob(event: FormEvent, targetJobId?: string) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = targetJobId ? edit : create;
      const response = await fetch(targetJobId ? `/api/target-jobs/${encodeURIComponent(targetJobId)}` : "/api/target-jobs", {
        method: targetJobId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fieldErrors = data.fieldErrors ? Object.values(data.fieldErrors).join(" ") : "";
        throw new Error(fieldErrors || data.error || "Unable to save target job");
      }
      if (targetJobId) {
        setJobs((current) => current.map((job) => job.id === targetJobId ? data.targetJob : job));
        setRefresh((current) => ({ ...current, [targetJobId]: (current[targetJobId] ?? 0) + 1 }));
        setEditingId(null);
      } else {
        setJobs((current) => [data.targetJob, ...current]);
        setCreate(blank);
        setShowCreate(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save target job");
    } finally {
      setSaving(false);
    }
  }

  async function deleteJob(id: string) {
    if (!window.confirm("Delete this saved target job?")) return;
    setError("");
    try {
      const response = await fetch(`/api/target-jobs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to delete target job");
      }
      setJobs((current) => current.filter((job) => job.id !== id));
      if (expanded?.id === id) setExpanded(null);
      if (editingId === id) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete target job");
    }
  }

  function beginEdit(job: TargetJob) {
    setEditingId(job.id);
    setExpanded(null);
    setEdit({ jobTitle: job.job_title, company: job.company ?? "", description: job.description });
    setError("");
  }

  function fields(value: JobFields, setValue: (value: JobFields) => void, prefix: string) {
    return <div className="space-y-4">
      <div><label htmlFor={`${prefix}-title`} className="mb-2 block text-sm font-medium">Job title</label>
        <input id={`${prefix}-title`} className={inputClass} required maxLength={120} value={value.jobTitle} onChange={(e) => setValue({ ...value, jobTitle: e.target.value })} /></div>
      <div><label htmlFor={`${prefix}-company`} className="mb-2 block text-sm font-medium">Company</label>
        <input id={`${prefix}-company`} className={inputClass} maxLength={120} value={value.company} onChange={(e) => setValue({ ...value, company: e.target.value })} /></div>
      <div><label htmlFor={`${prefix}-description`} className="mb-2 block text-sm font-medium">Job description</label>
        <textarea id={`${prefix}-description`} className={inputClass} required minLength={50} maxLength={10000} rows={8} value={value.description} onChange={(e) => setValue({ ...value, description: e.target.value })} /></div>
    </div>;
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Saved Target Jobs ({jobs.length})</h2>
      <button type="button" onClick={() => { setShowCreate((open) => !open); setError(""); }} className="rounded-md bg-cta px-4 py-2 font-semibold text-inverse">{showCreate ? "Close" : "+ Add Target Job"}</button>
    </div>
    {error && <p role="alert" className="text-sm text-error-text">{error}</p>}
    {showCreate && <form onSubmit={(event) => void sendJob(event)} className="space-y-4 rounded-xl border border-line-subtle bg-card p-6">
      <h3 className="font-semibold">Add Target Job</h3>
      {fields(create, setCreate, "new-job")}
      <button disabled={saving} type="submit" className="rounded-md bg-cta px-5 py-3 font-semibold text-inverse disabled:opacity-50">{saving ? "Saving…" : "Save Target Job"}</button>
    </form>}
    {loading ? <p className="text-secondary">Loading…</p> : jobs.length === 0 ? <p className="text-secondary">No target jobs saved yet.</p> :
      <div className="space-y-3">{jobs.map((job) => {
        const view = expanded?.id === job.id ? expanded.view : null;
        return <section key={job.id} className="rounded-xl border border-line-subtle bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold text-primary">{job.job_title}</h3><p className="text-sm text-secondary">{job.company || "Company not specified"}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => { setEditingId(null); setExpanded(view === "description" ? null : { id: job.id, view: "description" }); }} className="rounded-md border border-line-subtle px-3 py-2 text-sm">Description {view === "description" ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />}</button>
              <button type="button" onClick={() => { setEditingId(null); setExpanded(view === "insights" ? null : { id: job.id, view: "insights" }); }} className="rounded-md border border-line-subtle px-3 py-2 text-sm">Insights {view === "insights" ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />}</button>
              <button type="button" onClick={() => beginEdit(job)} className="rounded-md border border-line-subtle px-3 py-2 text-sm"><Pencil className="inline h-4 w-4" /> Edit</button>
              <button type="button" onClick={() => void deleteJob(job.id)} className="rounded-md p-2 text-error-text hover:bg-hover" aria-label={`Delete ${job.job_title}`}><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          {view === "description" && <div className="mt-4 border-t border-line-subtle pt-4"><h4 className="mb-2 font-semibold">Job Description</h4><p className="whitespace-pre-wrap break-words text-sm text-secondary">{job.description}</p></div>}
          {view === "insights" && <div className="mt-4 border-t border-line-subtle pt-4"><InterviewInsightsPanel targetJobId={job.id} refreshKey={refresh[job.id] ?? 0} /></div>}
          {editingId === job.id && <form onSubmit={(event) => void sendJob(event, job.id)} className="mt-4 space-y-4 border-t border-line-subtle pt-4">
            <h4 className="font-semibold">Edit Target Job</h4>{fields(edit, setEdit, `edit-${job.id}`)}
            <div className="flex gap-3"><button type="submit" disabled={saving} className="rounded-md bg-cta px-4 py-2 font-semibold text-inverse disabled:opacity-50">{saving ? "Saving…" : "Save Changes"}</button><button type="button" className="rounded-md border border-line-subtle px-4 py-2" onClick={() => setEditingId(null)}>Cancel</button></div>
          </form>}
        </section>;
      })}</div>}
  </div>;
}
