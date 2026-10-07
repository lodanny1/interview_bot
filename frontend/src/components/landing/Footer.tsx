// Footer.tsx — bottom bar with copyright and links.

import Image from "next/image";
import logo from "./images/logo.png";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <Image src={logo} alt="" className="brand-logo small" />
        <strong>Interview Bot</strong>
        <span>© {new Date().getFullYear()} Phyyvve Inc. All rights reserved.</span>
      </div>
      <nav className="footer-links">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Service</a>
        <a href="#">Contact Support</a>
      </nav>
    </footer>
  );
}
