import { useState, useEffect } from "react";

// Client-side activity log — stores admin actions in sessionStorage
const LOG_KEY = "admin_activity_log";

export function logAction(action, detail) {
  const logs = JSON.parse(sessionStorage.getItem(LOG_KEY) || "[]");
  logs.unshift({ action, detail, timestamp: new Date().toISOString(), id: Date.now() });
  sessionStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(0, 200)));
}

const ACTION_ICONS = {
  approve: "✅", reject: "❌", ban: "🚫", suspend: "⏸", activate: "🔓",
  delete: "🗑", login: "🔑", view: "👁️", default: "📝"
};

export default function ActivityLogsView() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const stored = JSON.parse(sessionStorage.getItem(LOG_KEY) || "[]");
    setLogs(stored);
  }, []);

  const actionTypes = ["all", ...new Set(logs.map(l => l.action))];

  const filtered = filter === "all" ? logs : logs.filter(l => l.action === filter);

  const clearLogs = () => { sessionStorage.removeItem(LOG_KEY); setLogs([]); };

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div><h2>Activity Logs</h2><p>{filtered.length} recorded actions this session</p></div>
        <button className="tbl-btn tbl-btn-danger" onClick={clearLogs}>🗑 Clear Logs</button>
      </div>

      <div className="filter-bar">
        <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
          {actionTypes.map(t => <option key={t} value={t}>{t === "all" ? "All Actions" : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="admin-empty">
          <span>📋</span>
          <p>No activity logs yet. Actions you take will appear here.</p>
        </div>
      ) : (
        <div className="log-list">
          {filtered.map(log => (
            <div className="log-item" key={log.id}>
              <div className="log-icon">{ACTION_ICONS[log.action] || ACTION_ICONS.default}</div>
              <div className="log-body">
                <div className="log-action">{log.action.charAt(0).toUpperCase() + log.action.slice(1)}</div>
                <div className="log-detail">{log.detail}</div>
              </div>
              <div className="log-time">{new Date(log.timestamp).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
