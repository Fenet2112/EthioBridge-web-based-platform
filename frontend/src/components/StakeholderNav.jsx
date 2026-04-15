import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { 
  FaIndustry, FaComments, FaBox, FaStar, FaUser, FaQuestionCircle,
  FaLink, FaTimes, FaHome, FaDoorOpen
} from "react-icons/fa";
import ProfileDropdown from "./ProfileDropdown";
import DarkModeToggle from "./DarkModeToggle";
import "./StakeholderNav.css";

const NAV_ITEMS = [
  { path: "/stakeholders",    icon: <FaIndustry />, label: "Industries"   },
  { path: "/messages",        icon: <FaComments />, label: "Messages"     },
  { path: "/products",        icon: <FaBox />, label: "Products"     },
  { path: "/recommendations", icon: <FaStar />, label: "For You"      },
  { path: "/profile",         icon: <FaUser />, label: "Profile"      },
  { path: "/subscription",    icon: <FaStar />, label: "Subscription" },
  { path: "/help",            icon: <FaQuestionCircle />, label: "Help"         },
];

function StakeholderNav({ unreadCount = 0 }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { logout } = useAuth();
  const active    = location.pathname;
  const [open, setOpen] = useState(false);
  const drawerRef = useRef(null);

  // Close drawer on outside click
  useEffect(() => {
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const go = (path) => { navigate(path); setOpen(false); };

  const handleLogout = () => { 
    logout(); 
    navigate("/"); 
  };

  return (
    <>
      {/* ── Top bar ── */}
      <nav className="sk-nav">
        {/* Hamburger */}
        <button
          className={`sk-burger ${open ? "open" : ""}`}
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span className="sk-bar" />
          <span className="sk-bar" />
          <span className="sk-bar" />
        </button>

        {/* Brand */}
        <div className="sk-nav-brand" onClick={() => go("/stakeholders")}>
          <span className="sk-nav-logo"><FaLink /></span>
          <span className="sk-nav-name">EthioBridge</span>
        </div>

        {/* Right side — always visible */}
        <div className="sk-nav-right">
          <Link to="/" className="sk-nav-home" title="Back to Home">
            <span className="material-icon">home</span>
          </Link>
          <DarkModeToggle />
          <ProfileDropdown />
        </div>
      </nav>

      {/* ── Backdrop ── */}
      {open && <div className="sk-backdrop" onClick={() => setOpen(false)} />}

      {/* ── Slide-in drawer ── */}
      <aside className={`sk-drawer ${open ? "open" : ""}`} ref={drawerRef}>
        <div className="sk-drawer-header">
          <span className="sk-drawer-title"><FaLink /> EthioBridge</span>
          <button className="sk-drawer-close" onClick={() => setOpen(false)}><FaTimes /></button>
        </div>

        <nav className="sk-drawer-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              className={`sk-drawer-item ${active === item.path ? "active" : ""}`}
              onClick={() => go(item.path)}
            >
              <span className="sk-drawer-icon">{item.icon}</span>
              <span className="sk-drawer-label">{item.label}</span>
              {item.path === "/messages" && unreadCount > 0 && (
                <span className="sk-drawer-badge">{unreadCount}</span>
              )}
              {active === item.path && <span className="sk-drawer-dot" />}
            </button>
          ))}
        </nav>

        <div className="sk-drawer-footer">
          <button className="sk-drawer-home" onClick={() => go("/")}>
            <span><FaHome /></span> Back to Home
          </button>
          <button className="sk-drawer-logout" onClick={handleLogout}>
            <span><FaDoorOpen /></span> Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export default StakeholderNav;
