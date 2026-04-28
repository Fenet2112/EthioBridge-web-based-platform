import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { 
  FaUsers, FaComments, FaBox, FaChartLine, FaUser, FaQuestionCircle,
  FaLink, FaTimes, FaHome, FaDoorOpen, FaClipboardList, FaBell
} from "react-icons/fa";
import ProfileDropdown from "./ProfileDropdown";
import DarkModeToggle from "./DarkModeToggle";
import "./IndustryNav.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const NAV_ITEMS = [
  { path: "/industry",        icon: <FaUsers />,         label: "Stakeholders"    },
  { path: "/industry/messages", icon: <FaComments />,    label: "Messages"        },
  { path: "/industry/products", icon: <FaBox />,         label: "Products"        },
  { path: "/industry/requests", icon: <FaClipboardList />, label: "Requests"     },
  { path: "/industry/analytics", icon: <FaChartLine />,  label: "Analytics"       },
  { path: "/industry/profile",   icon: <FaUser />,       label: "Profile"         },
  { path: "/help",               icon: <FaQuestionCircle />, label: "Help"        },
];

function IndustryNav({ unreadCount = 0 }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { logout } = useAuth();
  const active    = location.pathname;
  const [open, setOpen] = useState(false);
  const drawerRef = useRef(null);

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const notifRef = useRef(null);

  const tok = () => localStorage.getItem("token");

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch(`${API}/api/industry/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${tok()}` }
      });
      if (res.ok) { const d = await res.json(); setNotifUnread(d.count || 0); }
    } catch {}
  };

  const fetchNotifications = async () => {
    setNotifsLoading(true);
    try {
      const res = await fetch(`${API}/api/industry/notifications`, {
        headers: { Authorization: `Bearer ${tok()}` }
      });
      if (res.ok) { const d = await res.json(); setNotifications(d.notifications || []); }
    } catch {}
    finally { setNotifsLoading(false); }
  };

  const markRead = async (id) => {
    await fetch(`${API}/api/industry/notifications/${id}/read`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${tok()}` }
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setNotifUnread(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch(`${API}/api/industry/notifications/mark-all-read`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${tok()}` }
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setNotifUnread(0);
  };

  const fmtAgo = (d) => {
    const diff = Math.floor((Date.now() - new Date(d)) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  };

  useEffect(() => {
    if (tok()) { fetchUnreadCount(); }
  }, [location.pathname]);

  useEffect(() => {
    const interval = setInterval(() => { if (tok()) fetchUnreadCount(); }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close notif dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    if (showNotif) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotif]);

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

  const go = (path) => { 
    navigate(path);
    setOpen(false); 
  };

  const handleLogout = () => { 
    logout(); 
    navigate("/"); 
  };

  const handleHomeClick = (e) => {
    e.preventDefault();
    console.log('[IndustryNav] Navigating to home, logging out');
    
    // Logout and redirect to home
    logout();
    
    // Force navigation to home and reload to ensure clean state
    window.location.href = '/';
  };

  return (
    <>
      {/* ── Top bar ── */}
      <nav className="ind-nav">
        {/* Hamburger */}
        <button
          className={`ind-burger ${open ? "open" : ""}`}
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span className="ind-bar" />
          <span className="ind-bar" />
          <span className="ind-bar" />
        </button>

        {/* Brand */}
        <Link to="/industry" className="ind-nav-brand" title="Dashboard">
          <span className="ind-nav-logo"><FaLink /></span>
          <span className="ind-nav-name">EthioBridge</span>
        </Link>
        
        {/* Spacer */}
        <div style={{ flex: 1 }} />
        
        {/* Right side — always visible */}
        <div className="ind-nav-right">
          <Link to="/" className="ind-nav-home" title="Back to Home" onClick={handleHomeClick}>
            <FaHome />
          </Link>

          {/* Notification Bell */}
          <div className="ind-notif-wrap" ref={notifRef}>
            <button
              className="ind-notif-btn"
              title="Notifications"
              onClick={() => {
                setShowNotif(v => !v);
                if (!showNotif) fetchNotifications();
              }}
            >
              <FaBell />
              {notifUnread > 0 && <span className="ind-notif-badge">{notifUnread}</span>}
            </button>

            {showNotif && (
              <div className="ind-notif-dropdown">
                <div className="ind-notif-header">
                  <span>Notifications</span>
                  {notifUnread > 0 && (
                    <button className="ind-notif-mark-all" onClick={markAllRead}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="ind-notif-list">
                  {notifsLoading ? (
                    <div className="ind-notif-empty">Loading…</div>
                  ) : notifications.length === 0 ? (
                    <div className="ind-notif-empty">No notifications yet</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`ind-notif-item ${n.is_read ? "read" : "unread"}`}
                        onClick={() => { if (!n.is_read) markRead(n.id); setShowNotif(false); }}
                      >
                        <div className="ind-notif-title">{n.title}</div>
                        <div className="ind-notif-msg">{n.message}</div>
                        <div className="ind-notif-time">{fmtAgo(n.created_at)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <DarkModeToggle />
          <ProfileDropdown />
        </div>
      </nav>

      {/* ── Backdrop ── */}
      {open && <div className="ind-backdrop" onClick={() => setOpen(false)} />}

      {/* ── Slide-in drawer ── */}
      <aside className={`ind-drawer ${open ? "open" : ""}`} ref={drawerRef}>
        <div className="ind-drawer-header">
          <span className="ind-drawer-title"><FaLink /> EthioPartner</span>
          <button className="ind-drawer-close" onClick={() => setOpen(false)}><FaTimes /></button>
        </div>

        <nav className="ind-drawer-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              className={`ind-drawer-item ${active === item.path ? "active" : ""}`}
              onClick={() => go(item.path)}
            >
              <span className="ind-drawer-icon">{item.icon}</span>
              <span className="ind-drawer-label">{item.label}</span>
              {item.path === "/industry/messages" && unreadCount > 0 && (
                <span className="ind-drawer-badge">{unreadCount}</span>
              )}
              {active === item.path && <span className="ind-drawer-dot" />}
            </button>
          ))}
        </nav>

        <div className="ind-drawer-footer">
          <button className="ind-drawer-home" onClick={handleHomeClick}>
            <span><FaHome /></span> Back to Home
          </button>
          <button className="ind-drawer-logout" onClick={handleLogout}>
            <span><FaDoorOpen /></span> Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export default IndustryNav;
