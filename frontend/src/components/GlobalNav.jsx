import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Logo from "./Logo";
import DarkModeToggle from "./DarkModeToggle";
import "./GlobalNav.css";

function scrollToSection(e, sectionId) {
  e.preventDefault();
  const el = document.getElementById(sectionId);
  if (!el) return;
  const navHeight = 68;
  const top = el.getBoundingClientRect().top + window.scrollY - navHeight;
  window.scrollTo({ top, behavior: "smooth" });
  window.history.replaceState(null, "", `#${sectionId}`);
}

export default function GlobalNav() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`global-nav${scrolled ? " scrolled" : ""}`}>
      <Link to="/" className="global-nav-logo" onClick={() => setMenuOpen(false)}>
        <Logo size={40} color="#1d522d" />
        <span className="global-nav-logo-text">EthioBridge</span>
      </Link>

      <ul className={`global-nav-links${menuOpen ? " open" : ""}`}>
        <li><Link to="/" className={isHome ? "active" : ""} onClick={() => setMenuOpen(false)}>Home</Link></li>
        <li><Link to="/products" onClick={() => setMenuOpen(false)}>Products</Link></li>
        <li><Link to="/explore" onClick={() => setMenuOpen(false)}>Explore Map</Link></li>
        {isHome && (
          <>
            <li>
              <a href="#services" onClick={(e) => { scrollToSection(e, "services"); setMenuOpen(false); }}>
                Services
              </a>
            </li>
            <li>
              <a href="#about" onClick={(e) => { scrollToSection(e, "about"); setMenuOpen(false); }}>
                About
              </a>
            </li>
          </>
        )}
        <li><Link to="/help" onClick={() => setMenuOpen(false)}>Help</Link></li>
        {isHome && (
          <li>
            <a href="#contact" onClick={(e) => { scrollToSection(e, "contact"); setMenuOpen(false); }}>
              Contact
            </a>
          </li>
        )}
      </ul>

      <div className="global-nav-actions">
        <DarkModeToggle />
        <Link to="/login" className="global-nav-login">Log In</Link>
        <Link to="/signup" className="global-nav-signup">Get Started</Link>
        <button
          className={`global-nav-hamburger${menuOpen ? " open" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>
    </nav>
  );
}
