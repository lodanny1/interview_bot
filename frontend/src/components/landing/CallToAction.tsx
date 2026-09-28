// CallToAction.tsx — "Ready to Ace Your Next Interview?" banner.

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import robot from "./images/robot-thumbsup.png";

export default function CallToAction() {
  return (
    <section className="section section-tinted">
      <div className="cta">
        <p className="handwriting cta-left">A Brighter<br />You Awaits</p>

        <div className="cta-center">
          <h2>Ready to Ace Your Next Interview?</h2>
          <p>
            Join thousands of students and job seekers who are practicing
            smarter with Interview Bot by Phyyvve.
          </p>
          <Link href="/signup" className="btn btn-primary btn-lg">
            Start Practicing Free <ArrowRight size={18} />
          </Link>
          <small>No credit card required.</small>
        </div>

        <div className="cta-right">
          <Image src={robot} alt="Robot giving a thumbs up" />
          <p className="handwriting">Practice<br />Improve<br />Succeed</p>
        </div>
      </div>
    </section>
  );
}
