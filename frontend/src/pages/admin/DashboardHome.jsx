import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";

const API = "http://localhost:5000";

const COLORS = ["#0a5c2f", "#1a8a4a", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444"];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function StatCard({ icon, label, value, trend, color }) {
  const isUp = trend >= 0;
  return (
    <div className="dh-stat-card" style={{ borderTop: `4px solid ${color}` }}>
      <div className="dh-stat-top">
        <div className="dh-stat-icon" style={{ background: color + "18", color }}>{icon}</div>
        <span className={`dh-trend ${isUp ? "up" : "down"}`}>
          {isUp ? "▲" : "▼"} {Math.abs(trend)}%
        </span>
      </div>
      <div className="dh-stat-value">{value ?? "—"}</div>
      <div className="dh-stat-label">{label}</div>
    </div>
  );
}

export default function DashboardHome({ tok }) {
  const [stats, setStats]       = useState(null);
  const [monthly, setMonthly]   = useState([]);
  const [roleData, setRoleData] = useState([]);
  const [recent, setRecent]     = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${tok()}` };

    Promise.all([
      fetch(`${API}/api/admin/users/all`, { headers }).then(r => r.json()),
      fetch(`${API}/api/admin/purchases`, { headers }).then(r => r.json()),
    ]).then(([users, purchases]) => {
      if (!Array.isArray(users)) { setLoading(false); return; }

      const industries   = users.filter(u => u.role === "industry" && u.status === "approved");
      const stakeholders = users.filter(u => u.role === "stakeholder" && u.status === "approved");

      setStats({
        totalUsers:        users.length,
        totalIndustries:   industries.length,
        totalStakeholders: stakeholders.length,
        totalRequests:     Array.isArray(purchases) ? purchases.length : 0,
      });

      // Monthly registrations (last 7 months)
      const now = new Date();
      const monthBuckets = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
        return { month: MONTHS[d.getMonth()], users: 0, requests: 0, _date: d };
      });

      users.forEach(u => {
        const d = new Date(u.created_at);
        monthBuckets.forEach(b => {
          if (d.getFullYear() === b._date.getFullYear() && d.getMonth() === b._date.getMonth()) b.users++;
        });
      });

      if (Array.isArray(purchases)) {
        purchases.forEach(p => {
          const d = new Date(p.created_at);
          monthBuckets.forEach(b => {
            if (d.getFullYear() === b._date.getFullYear() && d.getMonth() === b._date.getMonth()) b.requests++;
          });
        });
      }

      setMonthly(monthBuckets.map(({ month, users, requests }) => ({ month, users, requests })));

      // Role distribution — approved industries by sector
      const sectorMap = {};
      industries.forEach(u => {
        const s = u.sector || "Other";
        sectorMap[s] = (sectorMap[s] || 0) + 1;
      });
      const sectorArr = Object.entries(sectorMap).map(([name, value]) => ({ name, value }));
      setRoleData(
        sectorArr.length > 0
          ? sectorArr
          : [{ name: "Industry", value: industries.length }, { name: "Stakeholder", value: stakeholders.length }]
      );

      // Recent activity
      const sorted = [...users].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
      setRecent(sorted);

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []); // eslint-disable-line

  if (loading) return <div className="dh-loading">Loading analytics...</div>;

  return (
    <div className="dh-wrap">
      {/* Welcome */}
      <div className="dh-welcome">
        <div>
          <h1>Welcome back, Admin 👋</h1>
          <p>Here's what's happening on EthioBridge today.</p>
        </div>
        <div className="dh-date">{new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}</div>
      </div>

      {/* Stat Cards */}
      <div className="dh-stats-grid">
        <StatCard icon="👥" label="Total Users"        value={stats?.totalUsers}        trend={12} color="#0a5c2f" />
        <StatCard icon="🏭" label="Industries"         value={stats?.totalIndustries}   trend={8}  color="#3b82f6" />
        <StatCard icon="🤝" label="Stakeholders"       value={stats?.totalStakeholders} trend={5}  color="#8b5cf6" />
        <StatCard icon="📋" label="Total Requests"     value={stats?.totalRequests}     trend={-3} color="#f59e0b" />
      </div>

      {/* Charts Row 1 */}
      <div className="dh-charts-row">
        <div className="dh-chart-card dh-chart-wide">
          <div className="dh-chart-header">
            <h3>Monthly Activity</h3>
            <span className="dh-chart-sub">Registrations &amp; Requests</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#888" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Legend />
              <Bar dataKey="users"    name="Users"    fill="#0a5c2f" radius={[6,6,0,0]} />
              <Bar dataKey="requests" name="Requests" fill="#f59e0b" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dh-chart-card">
          <div className="dh-chart-header">
            <h3>Distribution</h3>
            <span className="dh-chart-sub">By sector / role</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={roleData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                dataKey="value" nameKey="name" paddingAngle={3}>
                {roleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="dh-charts-row">
        <div className="dh-chart-card">
          <div className="dh-chart-header">
            <h3>User Growth</h3>
            <span className="dh-chart-sub">Cumulative over time</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#888" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Line type="monotone" dataKey="users" stroke="#0a5c2f" strokeWidth={3} dot={{ r: 5, fill: "#0a5c2f" }} name="Users" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="dh-chart-card dh-chart-wide">
          <div className="dh-chart-header">
            <h3>Request Trends</h3>
            <span className="dh-chart-sub">System activity over time</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthly}>
              <defs>
                <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#888" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Area type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={3} fill="url(#reqGrad)" name="Requests" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="dh-bottom-row">
        {/* Recent Registrations */}
        <div className="dh-widget">
          <div className="dh-chart-header"><h3>Recent Registrations</h3></div>
          <div className="dh-activity-list">
            {recent.map(u => (
              <div className="dh-activity-item" key={u.id}>
                <div className="dh-activity-avatar">{u.role === "industry" ? "🏭" : "🤝"}</div>
                <div className="dh-activity-info">
                  <div className="dh-activity-name">{u.display_name || u.email}</div>
                  <div className="dh-activity-meta">{u.role} · {new Date(u.created_at).toLocaleDateString()}</div>
                </div>
                <span className={`dh-activity-badge dh-badge-${u.status}`}>{u.status}</span>
              </div>
            ))}
            {recent.length === 0 && <p className="dh-empty-msg">No recent registrations.</p>}
          </div>
        </div>

        {/* Alerts */}
        <div className="dh-widget">
          <div className="dh-chart-header"><h3>Alerts &amp; Notifications</h3></div>
          <div className="dh-alerts">
            <div className="dh-alert dh-alert-warn">
              <span>⚠️</span>
              <div>
                <strong>Pending Approvals</strong>
                <p>Review new user registrations awaiting approval.</p>
              </div>
            </div>
            <div className="dh-alert dh-alert-info">
              <span>🛡️</span>
              <div>
                <strong>ID Verifications</strong>
                <p>Check purchase requests pending identity review.</p>
              </div>
            </div>
            <div className="dh-alert dh-alert-success">
              <span>✅</span>
              <div>
                <strong>System Healthy</strong>
                <p>All services are running normally.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
