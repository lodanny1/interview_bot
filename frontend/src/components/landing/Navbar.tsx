// Navbar.tsx — top navigation bar.
// "use client" is needed because this file uses useState (the phone menu
// opens and closes when clicked). On phones under 768px the links hide
// behind a menu button (AC 4).
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ArrowRight } from "lucide-react";
import logo from "./images/logo.png";

// sectionBase lets other pages (like /signup) link back to the landing page's
// sections, e.g. "/landing#features". On the landing page itself it stays "".
export default function Navbar({ sectionBase = "" }: { sectionBase?: string }) {
  // true = phone menu is open, false = closed
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="navbar">
      <Link href="/" className="brand" onClick={closeMenu}>
        <Image src={logo} alt="" className="brand-logo" />
        <span className="brand-name">Interview Bot</span>
        <span className="brand-by">by Phyyvve</span>
      </Link>

      {/* "open" is added to the class when the phone menu is showing */}
      <nav className={`nav-links ${menuOpen ? "open" : ""}`}>
        <a href={`${sectionBase}#features`} onClick={closeMenu}>Features</a>
        <a href={`${sectionBase}#how-it-works`} onClick={closeMenu}>How It Works</a>
        <a href={`${sectionBase}#pricing`} onClick={closeMenu}>Pricing</a>
        <a href={`${sectionBase}#faq`} onClick={closeMenu}>FAQ</a>
        {/* These two only show inside the phone menu */}
        <Link href="/login" className="mobile-only" onClick={closeMenu}>Sign In</Link>
        <Link href="/signup" className="mobile-only" onClick={closeMenu}>Start Practicing</Link>
      </nav>

      <div className="nav-actions">
        <Link href="/login" className="nav-signin">Sign In</Link>
        <Link href="/signup" className="btn btn-primary">
          Start Practicing <ArrowRight size={18} />
        </Link>
      </div>

      <button
        className="menu-button"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
    </header>
  );
}
