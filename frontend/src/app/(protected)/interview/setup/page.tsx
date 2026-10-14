"use client";

import { useState } from "react";
import { Upload, MessageSquare, Mic, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { InterviewMode } from "@/types/interview";
import { useRouter } from "next/navigation";

export default function InterviewSetupPage() {
  const [mode, setMode] = useState<InterviewMode>("text");
  const [title, setTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [role, setRole] = useState("");
  const router = useRouter();

  const modes: { value: InterviewMode; icon: typeof MessageSquare; label: string }[] = [
    { value: "text", icon: MessageSquare, label: "Text" },
    { value: "voice", icon: Mic, label: "Voice" },
    { value: "avatar", icon: User, label: "Avatar" },
  ];

  const handleCreate = () => {
    router.push(`/interview/session?mode=${mode}&title=${encodeURIComponent(title || "Interview")}`);
  };

  return (
    <div className="p-8 flex justify-center">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 text-center">Interview Context</h1>

        {/* Interview Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Interview Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>

        {/* Industry */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Industry</label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm focus:outline-none"
          >
            <option value="">Select industry</option>
            <option value="tech">Technology</option>
            <option value="finance">Finance</option>
            <option value="healthcare">Healthcare</option>
            <option value="consulting">Consulting</option>
          </select>
        </div>

        {/* Role */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            <option value="">Select role</option>
            <option value="engineer">Software Engineer</option>
            <option value="pm">Product Manager</option>
            <option value="designer">Designer</option>
            <option value="manager">Engineering Manager</option>
            <option value="data">Data Scientist</option>
          </select>
        </div>

        {/* Mode Toggle */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Mode</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "flex items-center justify-center w-14 h-10 transition-colors",
                  mode === m.value ? "bg-gray-700 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                <m.icon className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>

        {/* Resume Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Upload Resume</label>
          <div className="flex flex-col items-center justify-center p-10 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-150 transition-colors">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">Drag or upload Resume</p>
          </div>
        </div>

        {/* Create Button */}
        <button
          onClick={handleCreate}
          className="w-full py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
        >
          Create mockup interview
        </button>
      </div>
    </div>
  );
}
