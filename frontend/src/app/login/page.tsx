// Sign In page (Issue #02). Shares the sign-up page's layout and styles so the
// two auth pages look like one site.

import type { Metadata } from "next";
import Image from "next/image";
import { Inter } from "next/font/google";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { LoginForm } from "@/components/auth/LoginForm";
import robot from "@/components/landing/images/robot-hero.png";
import { loginAction } from "./actions";
import "@/components/landing/landing.css";
import "../signup/signup.css";
import "./login.css";

export const metadata: Metadata = {
  title: "Sign In - Phyyve",
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  // Set by the password reset flow after a successful reset.
  const { reset } = await searchParams;

  return (
    <div className={`landing ${inter.variable}`}>
      <Navbar sectionBase="/landing" />

      <main className="signup-page">
        <div className="signup-inner login-inner">
          {/* Left side: headline and robot */}
          <section className="signup-intro">
            <h1>
              Practice Interviews.
              <br />
              <span className="text-blue">Get Better Feedback.</span>
            </h1>
            <p className="signup-sub">
              Log in to continue your personalized AI practice sessions, track
              progress, and unlock actionable insights.
            </p>

            <div className="robot-card">
              <span className="login-sticker" aria-hidden="true">
                Better Interviews ✨
              </span>
              <div className="robot-card-art">
                <Image src={robot} alt="Interview Bot robot" priority />
              </div>
              <div className="robot-card-quote">
                <div>
                  <p className="quote">&quot;Practice makes progress.&quot;</p>
                  <p className="quote-by">— Interview Bot Guide</p>
                </div>
              </div>
            </div>
          </section>

          {/* Right side: the form card */}
          <section className="signup-card login-card" aria-labelledby="login-title">
            <header className="su-header">
              <h2 id="login-title">Welcome back</h2>
              <p>Enter your credentials to access your interview practice dashboard.</p>
            </header>

            {reset === "success" && (
              <p role="status" className="su-alert su-alert-success">
                Password updated. Sign in with your new password.
              </p>
            )}

            <LoginForm action={loginAction} />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
