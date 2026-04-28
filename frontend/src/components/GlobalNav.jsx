import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
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
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const isHome = location.pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogoClick = (e) => {
    if (isAuthenticated) {
      e.preventDefault();
      console.log('[GlobalNav] Authenticated user clicked home, logging out');
      logout();
      
      // Force navigation to home and reload to ensure clean state
      window.location.href = '/';
    }
    setMenuOpen(false);
  };

  const handleHomeNavClick = (e) => {
    if (isAuthenticated) {
      e.preventDefault();
      console.log('[GlobalNav] Authenticated user clicked home link, logging out');
      logout();
      
      // Force navigation to home and reload to ensure clean state
      window.location.href = '/';
    }
    setMenuOpen(false);
  };

  return (
    <nav className={`global-nav${scrolled ? " scrolled" : ""}`}>
      <Link to="/" className="global-nav-logo" onClick={handleLogoClick}>
        <Logo size={40} color="#1d522d" />
        <span className="global-nav-logo-text">EthioBridge</span>
      </Link>

      <ul className={`global-nav-links${menuOpen ? " open" : ""}`}>
        <li><Link to="/" className={isHome ? "active" : ""} onClick={handleHomeNavClick}>Home</Link></li>
        <li><Link to="/products" state={{ from: 'home' }} onClick={() => setMenuOpen(false)}>Products</Link></li>
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
