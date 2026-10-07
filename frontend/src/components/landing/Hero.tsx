// Hero.tsx — the big top section with the headline, buttons, and robot.

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Play, CircleCheck } from "lucide-react";
import robot from "./images/robot-hero.png";
import dashboardPreview from "./images/dashboard-preview.png";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-inner">
        <div className="hero-text">
          <span className="pill">Confidence for a brighter tomorrow</span>

          <h1>
            Practice Interviews.
            <br />
            <span className="text-blue">Get Better Feedback.</span>
          </h1>

          <p className="hero-sub">
            Interview Bot by Phyyvve helps you prepare for real interviews with
            AI-powered, realistic conversations, personalized feedback, and the
            tools you need to succeed.
          </p>

          <div className="hero-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">
              Start Free <ArrowRight size={18} />
            </Link>
            <a href="#how-it-works" className="btn btn-outline btn-lg">
              <span className="play-dot"><Play size={12} fill="currentColor" /></span>
              Watch Demo
            </a>
          </div>

          <ul className="hero-checks">
            <li><CircleCheck size={18} /> No credit card required</li>
            <li><CircleCheck size={18} /> Realistic AI interviews</li>
            <li><CircleCheck size={18} /> Used by students &amp; job seekers</li>
          </ul>
        </div>

        <div className="hero-art">
          <p className="handwriting hero-handwriting">
            Better<br />Interviews<br />Brighter<br />Futures
          </p>
          <div className="robot-circle">
            <Image src={robot} alt="Interview Bot robot waving" priority />
          </div>
          <div className="speech-bubble">You&apos;ve got this! ✨</div>
        </div>
      </div>

      {/* Preview of the app, taken from the Figma design */}
      <div className="preview-card">
        <Image src={dashboardPreview} alt="Preview of the Interview Bot dashboard" />
      </div>
    </section>
  );
}
