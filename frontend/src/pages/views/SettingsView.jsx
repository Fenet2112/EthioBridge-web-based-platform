import { useState } from "react";

export default function SettingsView({ darkMode, setDarkMode }) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="view-wrap">
      <div className="view-header"><div><h2>Settings</h2><p>System configuration and preferences</p></div></div>

      <div className="settings-grid">
        <div className="settings-card">
          <h3>🎨 Appearance</h3>
          <div className="settings-row">
            <div>
              <div className="settings-label">Dark Mode</div>
              <div className="settings-sub">Switch between light and dark theme</div>
            </div>
            <button className={`toggle-btn ${darkMode ? "on" : ""}`} onClick={() => setDarkMode(!darkMode)}>
              <span className="toggle-knob" />
            </button>
          </div>
        </div>

        <div className="settings-card">
          <h3>🔔 Notifications</h3>
          <div className="settings-row">
            <div>
              <div className="settings-label">Email Alerts</div>
              <div className="settings-sub">Receive email for new registrations</div>
            </div>
            <button className="toggle-btn on"><span className="toggle-knob" /></button>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">Purchase Alerts</div>
              <div className="settings-sub">Notify on new purchase requests</div>
            </div>
            <button className="toggle-btn on"><span className="toggle-knob" /></button>
          </div>
        </div>

        <div className="settings-card">
          <h3>⚙️ System Rules</h3>
          <div className="settings-field">
            <label>Free Request Limit per User</label>
            <input type="number" defaultValue={1} className="settings-input" />
          </div>
          <div className="settings-field">
            <label>Max Products per Industry (Free)</label>
            <input type="number" defaultValue={5} className="settings-input" />
          </div>
        </div>

        <div className="settings-card">
          <h3>🏷️ Categories</h3>
          <div className="settings-field">
            <label>Industry Sectors (comma-separated)</label>
            <textarea className="settings-textarea" defaultValue="Agriculture, Manufacturing, Technology, Healthcare, Finance, Energy, Retail, Construction" rows={3} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="approve-btn" style={{ width: "auto", padding: "12px 32px" }} onClick={handleSave}>
          {saved ? "✓ Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
