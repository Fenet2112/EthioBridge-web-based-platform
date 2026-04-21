import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";
import "./AnalyticsView.css";

const API = process.env.REACT_APP_API_URL || "https://ethiobridge-web-based-platform.onrender.com";

// ── Green palette ──
const GREEN_SHADES = ["#0a5c2f", "#1a8a4a", "#2db866", "#5dd68a", "#9eeab8", "#c8f5da"];
const SECTOR_COLORS = ["#0a5c2f","#1a8a4a","#2db866","#5dd68a","#9eeab8","#c8f5da","#667eea","#764ba2"];

// ── Formatters ──
const fmtETB = v => v >= 1_000_000
  ? `${(v / 1_000_000).toFixed(1)}M ETB`
  : v >= 1_000
  ? `${(v / 1_000).toFixed(1)}K ETB`
  : `${v} ETB`;

const fmtNum = v => v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(v);

const METRIC_OPTIONS = [
  { value: "revenue",      label: "Revenue (ETB)" },
  { value: "quantity",     label: "Quantity Sold" },
  { value: "transactions", label: "# Transactions" },
];
const PERIOD_OPTIONS = [
  { value: "7d",  label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

// ── Custom tooltip for bar chart ──
function BarTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const fmt = metric === "revenue" ? fmtETB : fmtNum;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
      <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#1f2937", fontSize: ".9rem" }}>{d.industry_name}</p>
      <p style={{ margin: "0 0 3px", color: "#0a5c2f", fontWeight: 600 }}>{fmt(d.value)}</p>
      <p style={{ margin: 0, color: "#6b7280", fontSize: ".78rem" }}>{d.sector}</p>
      <div style={{ marginTop: 6, borderTop: "1px solid #f3f4f6", paddingTop: 6, fontSize: ".75rem", color: "#9ca3af" }}>
        <span>{d.total_transactions} transactions</span>
        <span style={{ margin: "0 6px" }}>·</span>
        <span>{fmtNum(d.total_quantity)} units</span>
      </div>
    </div>
  );
}

// ── Truncate long names for X axis ──
function TickLabel({ x, y, payload }) {
  const name = payload.value.length > 12 ? payload.value.slice(0, 11) + "…" : payload.value;
  return (
    <text x={x} y={y + 12} textAnchor="middle" fill="#6b7280" fontSize={11} fontWeight={500}>
      {name}
    </text>
  );
}

export default function AnalyticsView({ tok }) {
  // ── Top sellers state ──
  const [sellers, setSellers] = useState([]);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [sellersError, setSellersError] = useState("");
  const [metric, setMetric] = useState("revenue");
  const [period, setPeriod] = useState("all");
  const [topN, setTopN] = useState(10);

  // ── General analytics state ──
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // ── Fetch top sellers ──
  const fetchSellers = useCallback(async () => {
    setSellersLoading(true); setSellersError("");
    try {
      const res = await fetch(
        `${API}/api/admin/analytics/top-sellers?metric=${metric}&period=${period}&limit=${topN}`,
        { headers: { Authorization: `Bearer ${tok()}` } }
      );
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      const data = await res.json();
      setSellers(data.sellers || []);
    } catch (e) { setSellersError(e.message); }
    finally { setSellersLoading(false); }
  }, [metric, period, topN, tok]);

  // ── Fetch general analytics ──
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/analytics`, {
        headers: { Authorization: `Bearer ${tok()}` }
      });
      if (res.ok) setAnalytics(await res.json());
    } catch {}
    finally { setAnalyticsLoading(false); }
  }, [tok]);

  useEffect(() => { fetchSellers(); }, [fetchSellers]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // ── Derived values ──
  const topSeller = sellers[0];
  const metricLabel = METRIC_OPTIONS.find(m => m.value === metric)?.label || "";
  const yFormatter = metric === "revenue" ? fmtETB : fmtNum;

  // ── User growth for line chart ──
  const userGrowthData = (analytics?.userGrowth || [])
    .slice().reverse()
    .map(r => ({
      month: new Date(r.month).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      users: parseInt(r.count)
    }));

  // ── Requests by status for pie ──
  const requestsData = (analytics?.requestsByStatus || []).map(r => ({
    name: r.status.replace("_", " "),
    value: parseInt(r.count)
  }));

  // ── Sector distribution ──
  const sectorData = (analytics?.sectorDistribution || []).map(r => ({
    name: r.sector || "Other",
    count: parseInt(r.count)
  }));

  return (
    <div className="analytics-view">

      {/* ── TOP SELLERS CHART ── */}
      <div className="av-section">
        <div className="av-section-header">
          <div>
            <h2 className="av-section-title">🏆 Top Selling Industries</h2>
            <p className="av-section-sub">Ranked by {metricLabel.toLowerCase()} · {PERIOD_OPTIONS.find(p => p.value === period)?.label}</p>
          </div>
          <button className="av-refresh-btn" onClick={fetchSellers} title="Refresh">↻</button>
        </div>

        {/* Controls */}
        <div className="av-controls">
          <div className="av-control-group">
            <label>Metric</label>
            <div className="av-btn-group">
              {METRIC_OPTIONS.map(m => (
                <button key={m.value} className={`av-toggle-btn ${metric === m.value ? "active" : ""}`} onClick={() => setMetric(m.value)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="av-control-group">
            <label>Period</label>
            <div className="av-btn-group">
              {PERIOD_OPTIONS.map(p => (
                <button key={p.value} className={`av-toggle-btn ${period === p.value ? "active" : ""}`} onClick={() => setPeriod(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="av-control-group">
            <label>Show top</label>
            <select className="av-select" value={topN} onChange={e => setTopN(parseInt(e.target.value))}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
            </select>
          </div>
        </div>

        {/* Top performer highlight */}
        {!sellersLoading && topSeller && (
          <div className="av-top-performer">
            <div className="av-top-badge">🥇 #1</div>
            <div className="av-top-info">
              <span className="av-top-name">{topSeller.industry_name}</span>
              <span className="av-top-sector">{topSeller.sector}</span>
            </div>
            <div className="av-top-value">{yFormatter(topSeller.value)}</div>
          </div>
        )}

        {/* Bar chart */}
        {sellersLoading ? (
          <div className="av-loading"><div className="av-spinner" /><p>Loading chart…</p></div>
        ) : sellersError ? (
          <div className="av-error">⚠️ {sellersError}</div>
        ) : sellers.length === 0 ? (
          <div className="av-empty">
            <span>📊</span>
            <p>No sales data yet for this period.</p>
            <small>Data appears once purchase requests are approved.</small>
          </div>
        ) : (
          <div className="av-chart-wrap">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={sellers} margin={{ top: 10, right: 20, left: 20, bottom: 20 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="industry_name" tick={<TickLabel />} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={yFormatter} tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<BarTooltip metric={metric} />} cursor={{ fill: "rgba(10,92,47,.06)" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {sellers.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#0a5c2f" : i === 1 ? "#1a8a4a" : i === 2 ? "#2db866" : "#5dd68a"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Rank table */}
        {!sellersLoading && sellers.length > 0 && (
          <div className="av-rank-table-wrap">
            <table className="av-rank-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Industry</th>
                  <th>Sector</th>
                  <th>Revenue</th>
                  <th>Qty Sold</th>
                  <th>Transactions</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((s, i) => (
                  <tr key={s.id} className={i === 0 ? "av-rank-top" : ""}>
                    <td className="av-rank-num">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </td>
                    <td className="av-rank-name">{s.industry_name}</td>
                    <td className="av-rank-sector">{s.sector}</td>
                    <td className="av-rank-val">{fmtETB(s.total_revenue)}</td>
                    <td className="av-rank-val">{fmtNum(s.total_quantity)}</td>
                    <td className="av-rank-val">{s.total_transactions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── GENERAL ANALYTICS ── */}
      {analyticsLoading ? (
        <div className="av-loading"><div className="av-spinner" /><p>Loading analytics…</p></div>
      ) : analytics && (
        <div className="av-grid-2">

          {/* User growth line chart */}
          <div className="av-section">
            <div className="av-section-header">
              <div>
                <h2 className="av-section-title">📈 User Growth</h2>
                <p className="av-section-sub">New registrations per month</p>
              </div>
            </div>
            {userGrowthData.length === 0 ? (
              <div className="av-empty"><span>📈</span><p>No user data yet.</p></div>
            ) : (
              <div className="av-chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={userGrowthData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb" }} />
                    <Line type="monotone" dataKey="users" stroke="#0a5c2f" strokeWidth={2.5} dot={{ fill: "#0a5c2f", r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Requests by status pie */}
          <div className="av-section">
            <div className="av-section-header">
              <div>
                <h2 className="av-section-title">🛒 Requests by Status</h2>
                <p className="av-section-sub">Distribution of purchase request statuses</p>
              </div>
            </div>
            {requestsData.length === 0 ? (
              <div className="av-empty"><span>🛒</span><p>No request data yet.</p></div>
            ) : (
              <div className="av-chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={requestsData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {requestsData.map((_, i) => <Cell key={i} fill={GREEN_SHADES[i % GREEN_SHADES.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Sector distribution bar */}
          <div className="av-section av-section-full">
            <div className="av-section-header">
              <div>
                <h2 className="av-section-title">🏭 Industries by Sector</h2>
                <p className="av-section-sub">Number of approved industries per sector</p>
              </div>
            </div>
            {sectorData.length === 0 ? (
              <div className="av-empty"><span>🏭</span><p>No sector data yet.</p></div>
            ) : (
              <div className="av-chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={sectorData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="name" tick={<TickLabel />} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb" }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                      {sectorData.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
