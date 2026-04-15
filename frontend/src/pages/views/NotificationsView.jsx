import { useState, useEffect } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function NotificationsView({ tok }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = { Authorization: `Bearer ${tok()}` };
    Promise.all([
      fetch(`${API}/api/admin/pending`, { headers: h }).then(r => r.json()),
      fetch(`${API}/api/admin/purchases?status=pending_verification`, { headers: h }).then(r => r.json()),
      fetch(`${API}/api/admin/purchases?status=pending`, { headers: h }).then(r => r.json()),
    ]).then(([pending, idReview, pendingReq]) => {
      const notifs = [];

      if (Array.isArray(pending) && pending.length > 0) {
        notifs.push({
          id: "pending-users",
          type: "warning",
          icon: "👥",
          title: `${pending.length} Pending User Application${pending.length > 1 ? "s" : ""}`,
          body: "New users are waiting for approval. Review and approve or reject their applications.",
          time: new Date().toISOString(),
          action: "users",
        });
      }

      if (Array.isArray(idReview) && idReview.length > 0) {
        notifs.push({
          id: "id-review",
          type: "info",
          icon: "🛡️",
          title: `${idReview.length} ID Verification${idReview.length > 1 ? "s" : ""} Pending`,
          body: "Stakeholders have uploaded identity documents awaiting your review.",
          time: new Date().toISOString(),
          action: "purchases",
        });
      }

      if (Array.isArray(pendingReq) && pendingReq.length > 0) {
        notifs.push({
          id: "pending-requests",
          type: "success",
          icon: "📋",
          title: `${pendingReq.length} Purchase Request${pendingReq.length > 1 ? "s" : ""} Awaiting Review`,
          body: "New purchase requests have been submitted and need your attention.",
          time: new Date().toISOString(),
          action: "purchases",
        });
      }

      if (notifs.length === 0) {
        notifs.push({
          id: "all-clear",
          type: "success",
          icon: "✅",
          title: "All Clear",
          body: "No pending actions. The system is up to date.",
          time: new Date().toISOString(),
        });
      }

      setNotifications(notifs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []); // eslint-disable-line

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div><h2>Notifications</h2><p>{notifications.length} active alerts</p></div>
      </div>

      {loading ? <div className="admin-loading">Loading...</div> : (
        <div className="notif-list">
          {notifications.map(n => (
            <div className={`notif-card notif-${n.type}`} key={n.id}>
              <div className="notif-icon">{n.icon}</div>
              <div className="notif-body">
                <div className="notif-title">{n.title}</div>
                <div className="notif-text">{n.body}</div>
                <div className="notif-time">{new Date(n.time).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
