import { ArrowRight } from "lucide-react";
import { mockSkills, mockReports } from "@/lib/mock-data";

export default function ProgressPage() {
  const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const streakDays = [true, true, true, true, true, true, false]; // filled = practiced

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Progress</h1>
        <p className="text-sm text-gray-500">
          Earn badges, hit milestones, and track your progress
        </p>
      </div>

      <div className="flex gap-8">
        {/* Left Column */}
        <div className="flex-1 space-y-8">
          {/* Weekly Streaks */}
          <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Weekly Streaks</h3>
            <div className="flex items-center justify-center gap-4">
              {weekDays.map((day, i) => (
                <div key={day} className="flex flex-col items-center gap-2">
                  <div
                    className={`w-10 h-10 rounded-full ${
                      streakDays[i] ? "bg-gray-700" : "bg-gray-300"
                    }`}
                  />
                  <span className="text-xs font-medium text-gray-600">{day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Badges Grid (placeholder) */}
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center p-4 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <div className="w-12 h-12 bg-gray-200 rounded-lg mb-2 flex items-center justify-center">
                  <span className="text-gray-400 text-xs">🏆</span>
                </div>
                <p className="text-sm font-medium text-gray-700">Title</p>
                <p className="text-xs text-gray-400">Desc</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="w-80 space-y-8">
          {/* Overall Skill Performance */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Overall Skill Performance
            </h3>
            <div className="space-y-4">
              {mockSkills.map((skill) => (
                <div key={skill.name} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-32 shrink-0">{skill.name}</span>
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-700 rounded-full"
                      style={{ width: `${skill.score}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-10 text-right">
                    {skill.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Post-interview Reports */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Post-interview Reports
            </h3>
            <div className="space-y-3">
              {mockReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  <span className="font-medium text-gray-900">{report.title}</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
