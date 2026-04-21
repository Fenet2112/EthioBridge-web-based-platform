import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { 
  FaIndustry, FaComments, FaBox, FaStar, FaUser, FaQuestionCircle,
  FaTimes, FaHome, FaDoorOpen
} from "react-icons/fa";
import Logo from "./Logo";
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

function StakeholderNav({ unreadCount = 0, showSidebar = true }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { logout } = useAuth();
  const active    = location.pathname;
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const sidebarRef = useRef(null);

  // Close sidebar on outside click when expanded
  useEffect(() => {
    const handler = (e) => {
      if (sidebarExpanded && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setSidebarExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sidebarExpanded]);

  const go = (path) => { navigate(path); };

  const handleLogout = () => { 
    logout(); 
    navigate("/"); 
  };

  return (
    <>
      {/* ── Top bar ── */}
      <nav className="sk-nav">
        {/* Logo */}
        <Link to="/stakeholders" className="sk-nav-brand" title="EthioBridge">
          <Logo size={32} color="#4ade80" />
          <span className="sk-nav-name">EthioBridge</span>
        </Link>
        
        {/* Spacer */}
        <div style={{ flex: 1 }} />
        
        {/* Right side — always visible */}
        <div className="sk-nav-right">
          <DarkModeToggle />
          <ProfileDropdown />
        </div>
      </nav>

      {/* ── Collapsible Sidebar (only on non-home pages) ── */}
      {showSidebar && (
        <aside 
          className={`sk-sidebar ${sidebarExpanded ? "expanded" : ""}`} 
          ref={sidebarRef}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
        >
          <nav className="sk-sidebar-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.path}
                className={`sk-sidebar-item ${active === item.path ? "active" : ""}`}
                onClick={() => go(item.path)}
                title={item.label}
              >
                <span className="sk-sidebar-icon">{item.icon}</span>
                <span className="sk-sidebar-label">{item.label}</span>
                {item.path === "/messages" && unreadCount > 0 && (
                  <span className="sk-sidebar-badge">{unreadCount}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="sk-sidebar-footer">
            <button className="sk-sidebar-home" onClick={() => go("/")} title="Back to Home">
              <span className="sk-sidebar-icon"><FaHome /></span>
              <span className="sk-sidebar-label">Back to Home</span>
            </button>
            <button className="sk-sidebar-logout" onClick={handleLogout} title="Logout">
              <span className="sk-sidebar-icon"><FaDoorOpen /></span>
              <span className="sk-sidebar-label">Logout</span>
            </button>
          </div>
        </aside>
      )}
    </>
  );
}

export default StakeholderNav;
