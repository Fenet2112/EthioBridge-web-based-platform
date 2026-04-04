import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";

const API = "http://localhost:5000";
const COLORS = ["#0a5c2f","#1a8a4a","#f59e0b","#3b82f6","#8b5cf6","#ef4444","#06b6d4","#ec4899"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AnalyticsView({ tok }) {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = { Authorization: `Bearer ${tok()}` };
    Promise.all([
      fetch(`${API}/api/admin/analytics`, { headers: h }).then(r => r.json()),
      fetch(`${API}/api/admin/users/all`, { headers: h }).then(r => r.json()),
      fetch(`${API}/api/admin/purchases`, { headers: h }).then(r => r.json()),
    ]).then(([analytics, allUsers, allPurchases]) => {
      setData(analytics);
      setUsers(Array.isArray(allUsers) ? allUsers : []);
      setPurchases(Array.isArray(allPurchases) ? allPurchases : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []); // eslint-disable-line

  if (loading) return <div className="admin-loading">Loading analytics...</div>;

  // Monthly buckets (last 8 months)
  const now = new Date();
  const monthly = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (7 - i), 1);
    const label = MONTHS[d.getMonth()];
    const uCount = users.filter(u => {
      const ud = new Date(u.created_at);
      return ud.getFullYear() === d.getFullYear() && ud.getMonth() === d.getMonth();
    }).length;
    const rCount = purchases.filter(p => {
      const pd = new Date(p.created_at);
      return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
    }).length;
    return { month: label, users: uCount, requests: rCount };
  });

  // Cumulative growth
  let cumUsers = 0;
  const growthData = monthly.map(m => { cumUsers += m.users; return { month: m.month, total: cumUsers }; });

  // Request status breakdown
  const statusData = (data?.requestsByStatus || []).map(r => ({ name: r.status, value: Number(r.count) }));

  // Sector distribution
  const sectorData = (data?.sectorDistribution || []).map(s => ({ name: s.sector || "Other", value: Number(s.count) }));

  // Top products by requests
  const productMap = {};
  purchases.forEach(p => {
    if (!p.product_name) return;
    productMap[p.product_name] = (productMap[p.product_name] || 0) + 1;
  });
  const topProducts = Object.entries(productMap).sort((a,b) => b[1]-a[1]).slice(0,6).map(([name,count]) => ({ name, count }));

  const totalApproved = purchases.filter(p => p.status === "approved").length;
  const convRate = purchases.length ? Math.round((totalApproved / purchases.length) * 100) : 0;

  return (
    <div className="view-wrap">
      <div className="view-header"><div><h2>Analytics &amp; Reports</h2><p>System-wide performance overview</p></div></div>

      {/* KPI row */}
      <div className="analytics-kpi-row">
        {[
          { label: "Total Users",       value: users.length,                  icon: "👥", color: "#0a5c2f" },
          { label: "Total Requests",    value: purchases.length,              icon: "📋", color: "#3b82f6" },
          { label: "Approval Rate",     value: convRate + "%",                icon: "✅", color: "#1a8a4a" },
          { label: "Total Products",    value: data?.totalProducts || "—",    icon: "📦", color: "#f59e0b" },
        ].map(k => (
          <div className="analytics-kpi" key={k.label} style={{ borderLeft: `4px solid ${k.color}` }}>
            <span className="kpi-icon" style={{ color: k.color }}>{k.icon}</span>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="analytics-charts-row">
        <div className="analytics-chart-card wide">
          <h3>Monthly Activity</h3>
          <p className="chart-sub">Registrations vs Purchase Requests</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Legend />
              <Bar dataKey="users" name="New Users" fill="#0a5c2f" radius={[5,5,0,0]} />
              <Bar dataKey="requests" name="Requests" fill="#f59e0b" radius={[5,5,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="analytics-chart-card">
          <h3>Request Status</h3>
          <p className="chart-sub">Distribution by status</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" nameKey="name" paddingAngle={3}>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="analytics-charts-row">
        <div className="analytics-chart-card">
          <h3>User Growth</h3>
          <p className="chart-sub">Cumulative registrations</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Line type="monotone" dataKey="total" stroke="#0a5c2f" strokeWidth={3} dot={{ r: 4, fill: "#0a5c2f" }} name="Total Users" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="analytics-chart-card">
          <h3>Sector Distribution</h3>
          <p className="chart-sub">Industries by sector</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sectorData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" paddingAngle={2}>
                {sectorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="analytics-chart-card">
          <h3>Request Trends</h3>
          <p className="chart-sub">Activity over time</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthly}>
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Area type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={3} fill="url(#aGrad)" name="Requests" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products */}
      {topProducts.length > 0 && (
        <div className="analytics-chart-card" style={{ marginTop: 0 }}>
          <h3>Top Products by Requests</h3>
          <p className="chart-sub">Most requested products across all industries</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#555" }} axisLine={false} tickLine={false} width={120} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Bar dataKey="count" name="Requests" fill="#0a5c2f" radius={[0,5,5,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
