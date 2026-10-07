// Create Account page (Issue #01), built from the "SignUp" Figma frame.
// Reuses the landing page's nav bar, footer, fonts and colors so the two
// pages look like one site.

import type { Metadata } from "next";
import Image from "next/image";
import { Inter, Caveat } from "next/font/google";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { SignUpForm } from "@/components/auth/SignUpForm";
import robot from "@/components/landing/images/robot-hero.png";
import { signUpAction } from "./actions";
import "@/components/landing/landing.css";
import "./signup.css";

export const metadata: Metadata = {
  title: "Create Account - Phyyve",
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const caveat = Caveat({ subsets: ["latin"], weight: "600", variable: "--font-caveat" });

export default function SignUpPage() {
  return (
    <div className={`landing ${inter.variable} ${caveat.variable}`}>
      <Navbar sectionBase="/landing" />

      <main className="signup-page">
        <div className="signup-inner">
          {/* Left side: headline and robot */}
          <section className="signup-intro">
            <span className="pill">
              <span className="pill-dot" aria-hidden="true" /> Start your journey today
            </span>
            <h1>
              Practice Interviews.
              <br />
              <span className="text-blue">Land Your Dream Job.</span>
            </h1>
            <p className="signup-sub">
              Join thousands of job seekers who practice smarter with AI-powered mock
              interviews, instant real-time feedback, and tailored career insights.
            </p>

            <div className="robot-card">
              <span className="robot-tag">Better Interviews ✨</span>
              <span className="robot-bubble">You&apos;ve got this! ✨</span>
              <div className="robot-card-art">
                <Image src={robot} alt="Interview Bot robot waving" priority />
              </div>
              <div className="robot-card-quote">
                <div>
                  <p className="quote">&quot;The fastest way to ace your interviews.&quot;</p>
                  <p className="quote-by">— Interview Bot AI Coach</p>
                </div>
                <span className="sessions-pill">15,000+ Sessions</span>
              </div>
            </div>
          </section>

          {/* Right side: the form card */}
          <section className="signup-card" aria-labelledby="signup-title">
            <SignUpForm action={signUpAction} />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
