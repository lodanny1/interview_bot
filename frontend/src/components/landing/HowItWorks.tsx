// HowItWorks.tsx — "Get Started in 3 Simple Steps".

import { Fragment } from "react";
import { Briefcase, Bot, ChartColumn, ArrowRight } from "lucide-react";

const steps = [
  { icon: Briefcase, title: "Choose a Role",
    text: "Pick your target role or field (e.g. Software Engineer, Product Manager)." },
  { icon: Bot, title: "Practice with AI",
    text: "Answer realistic interview questions via voice, text, or coding." },
  { icon: ChartColumn, title: "Get Feedback & Improve",
    text: "Receive instant, personalized feedback and track your progress." },
];

export default function HowItWorks() {
  return (
    <section className="section section-tinted" id="how-it-works">
      <div className="section-header">
        <div>
          <p className="eyebrow">How it works</p>
          <h2>Get Started in 3 Simple Steps</h2>
        </div>
        <p className="section-tagline">From practice to progress, in minutes.</p>
      </div>

      <div className="steps">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <Fragment key={title}>
            <div className="card step-card">
              <span className="step-number">{i + 1}</span>
              <div>
                <div className="icon-box icon-blue"><Icon size={18} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
            {/* arrow between cards, but not after the last one */}
            {i < steps.length - 1 && <ArrowRight className="step-arrow" size={24} />}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
