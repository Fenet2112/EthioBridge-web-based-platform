import { Link, useLocation } from "react-router-dom";
import Logo from "./Logo";
import DarkModeToggle from "./DarkModeToggle";
import "./GlobalNav.css";

/**
 * Scroll to a section so it appears at the TOP of the viewport,
 * offset by the navbar height (68px) so it isn't hidden behind it.
 */
function scrollToSection(e, sectionId) {
  e.preventDefault();
  const el = document.getElementById(sectionId);
  if (!el) return;

  const navHeight = 68; // matches .global-nav height in CSS
  const top = el.getBoundingClientRect().top + window.scrollY - navHeight;

  window.scrollTo({ top, behavior: "smooth" });

  // Update URL hash without triggering default jump
  window.history.replaceState(null, "", `#${sectionId}`);
}

export default function GlobalNav() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <nav className="global-nav">
      <Link to="/" className="global-nav-logo">
        <Logo size={40} color="#1d522d" />
        <span className="global-nav-logo-text">EthioBridge</span>
      </Link>

      <ul className="global-nav-links">
        <li><Link to="/" className={isHome ? "active" : ""}>Home</Link></li>
        <li><Link to="/products">Products</Link></li>
        <li><Link to="/explore">Explore Map</Link></li>
        {isHome && (
          <>
            <li>
              <a href="#services" onClick={(e) => scrollToSection(e, "services")}>
                Services
              </a>
            </li>
            <li>
              <a href="#about" onClick={(e) => scrollToSection(e, "about")}>
                About
              </a>
            </li>
          </>
        )}
        <li><Link to="/help">Help</Link></li>
        {isHome && (
          <li>
            <a href="#contact" onClick={(e) => scrollToSection(e, "contact")}>
              Contact
            </a>
          </li>
        )}
      </ul>

      <div className="global-nav-actions">
        <DarkModeToggle />
        <Link to="/login" className="global-nav-login">Log In</Link>
        <Link to="/signup" className="global-nav-signup">Get Started</Link>
      </div>
    </nav>
  );
}
