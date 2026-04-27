import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { 
  FaIndustry, FaComments, FaBox, FaStar, FaUser, FaQuestionCircle,
  FaLink, FaTimes, FaHome, FaDoorOpen, FaClipboardList, FaBell,
  FaShoppingCart
} from "react-icons/fa";
import ProfileDropdown from "./ProfileDropdown";
import DarkModeToggle from "./DarkModeToggle";
import "./StakeholderNav.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const NAV_ITEMS = [
  { path: "/stakeholders",    icon: <FaIndustry />,     label: "Industries"      },
  { path: "/my-transactions", icon: <FaClipboardList />, label: "My Transactions" },
  { path: "/messages",        icon: <FaComments />,     label: "Messages"        },
  { path: "/products",        icon: <FaBox />,          label: "Products"        },
  { path: "/recommendations", icon: <FaStar />,         label: "For You"         },
  { path: "/profile",         icon: <FaUser />,         label: "Profile"         },
  { path: "/subscription",    icon: <FaStar />,         label: "Subscription"    },
  { path: "/help",            icon: <FaQuestionCircle />, label: "Help"          },
];

function StakeholderNav({ unreadCount = 0, userLocation, locationLoading, requestUserLocation }) {
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
      const res = await fetch(`${API}/api/stakeholder/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${tok()}` }
      });
      if (res.ok) { const d = await res.json(); setNotifUnread(d.count || 0); }
    } catch {}
  };

  const fetchNotifications = async () => {
    setNotifsLoading(true);
    try {
      const res = await fetch(`${API}/api/stakeholder/notifications`, {
        headers: { Authorization: `Bearer ${tok()}` }
      });
      if (res.ok) { const d = await res.json(); setNotifications(d.notifications || []); }
    } catch {}
    finally { setNotifsLoading(false); }
  };

  const markRead = async (id) => {
    await fetch(`${API}/api/stakeholder/notifications/${id}/read`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${tok()}` }
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setNotifUnread(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch(`${API}/api/stakeholder/notifications/mark-all-read`, {
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
        <Link to="/stakeholders" className="sk-nav-brand" title="Industries">
          <span className="sk-nav-logo"><FaLink /></span>
          <span className="sk-nav-name">EthioBridge</span>
        </Link>
        
        {/* Spacer */}
        <div style={{ flex: 1 }} />
        
        {/* Right side — always visible */}
        <div className="sk-nav-right">
          <Link to="/cart" className="sk-nav-home sk-cart-btn" title="Cart">
            <FaShoppingCart />
          </Link>
          <Link to="/" className="sk-nav-home" title="Back to Home">
            <FaHome />
          </Link>

          {/* Notification Bell */}
          <div className="sk-notif-wrap" ref={notifRef}>
            <button
              className="sk-notif-btn"
              title="Notifications"
              onClick={() => {
                setShowNotif(v => !v);
                if (!showNotif) fetchNotifications();
              }}
            >
              <FaBell />
              {notifUnread > 0 && <span className="sk-notif-badge">{notifUnread}</span>}
            </button>

            {showNotif && (
              <div className="sk-notif-dropdown">
                <div className="sk-notif-header">
                  <span>Notifications</span>
                  {notifUnread > 0 && (
                    <button className="sk-notif-mark-all" onClick={markAllRead}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="sk-notif-list">
                  {notifsLoading ? (
                    <div className="sk-notif-empty">Loading…</div>
                  ) : notifications.length === 0 ? (
                    <div className="sk-notif-empty">No notifications yet</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`sk-notif-item ${n.is_read ? "read" : "unread"}`}
                        onClick={() => { if (!n.is_read) markRead(n.id); setShowNotif(false); }}
                      >
                        <div className="sk-notif-title">{n.title}</div>
                        <div className="sk-notif-msg">{n.message}</div>
                        <div className="sk-notif-time">{fmtAgo(n.created_at)}</div>
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
      {open && <div className="sk-backdrop" onClick={() => setOpen(false)} />}

      {/* ── Slide-in drawer ── */}
      <aside className={`sk-drawer ${open ? "open" : ""}`} ref={drawerRef}>
        <div className="sk-drawer-header">
          <span className="sk-drawer-title"><FaLink /> EthioPartner</span>
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
