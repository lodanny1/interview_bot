// LandingPage.tsx — the public home page (Issue #51).
// It stacks the landing sections in order. Each section is its own file
// so teammates can edit different sections without merge conflicts.

import { Inter, Caveat } from "next/font/google";
import Navbar from "./Navbar";
import Hero from "./Hero";
import Features from "./Features";
import HowItWorks from "./HowItWorks";
import CallToAction from "./CallToAction";
import Footer from "./Footer";
import "./landing.css";

// Fonts from the Figma design. Next.js downloads these automatically.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const caveat = Caveat({ subsets: ["latin"], weight: "600", variable: "--font-caveat" });

export default function LandingPage() {
  return (
    <div className={`landing ${inter.variable} ${caveat.variable}`}>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
