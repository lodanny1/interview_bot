// Features.tsx — "Powerful Features for Your Success" cards.
// The cards come from a list, so adding a feature = adding one object.

import { Target, Zap, ChartColumn, CodeXml, TrendingUp, User } from "lucide-react";

const features = [
  { icon: Target, color: "blue", title: "Realistic Mock Interviews",
    text: "Practice with industry-relevant questions and natural conversations." },
  { icon: Zap, color: "blue", title: "Instant AI Feedback",
    text: "Get detailed, actionable feedback after every interview." },
  { icon: ChartColumn, color: "indigo", title: "Communication Analysis",
    text: "Understand your clarity, confidence, and speaking style." },
  { icon: CodeXml, color: "teal", title: "Technical Practice",
    text: "Sharpen your coding skills with real problems and AI guidance." },
  { icon: TrendingUp, color: "purple", title: "Progress Tracking",
    text: "See your improvement over time with detailed insights." },
  { icon: User, color: "purple", title: "Personalized Guidance",
    text: "Get tailored tips based on your goals and performance." },
];

export default function Features() {
  return (
    <section className="section" id="features">
      <div className="section-header">
        <div>
          <p className="eyebrow">Everything you need</p>
          <h2>Powerful Features for Your Success</h2>
        </div>
        <p className="section-tagline">More practice. Better feedback. A brighter you.</p>
      </div>

      <div className="feature-grid">
        {features.map(({ icon: Icon, color, title, text }) => (
          <div className="card feature-card" key={title}>
            <div className={`icon-box icon-${color}`}><Icon size={20} /></div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
