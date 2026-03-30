import { useTheme } from "../context/ThemeContext";
import "./DarkModeToggle.css";

function DarkModeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button
      className={`dm-toggle ${dark ? "dm-on" : ""}`}
      onClick={toggle}
      title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle dark mode"
    >
      <span className="dm-icon">{dark ? "☀️" : "🌙"}</span>
      <span className="dm-track">
        <span className="dm-thumb" />
      </span>
    </button>
  );
}

export default DarkModeToggle;
