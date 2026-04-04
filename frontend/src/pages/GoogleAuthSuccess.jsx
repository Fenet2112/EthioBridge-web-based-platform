import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function GoogleAuthSuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const token    = params.get("token");
    const userStr  = params.get("user");
    const redirect = params.get("redirect") || "/stakeholders";

    if (token && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        navigate(redirect, { replace: true });
      } catch {
        navigate("/login?error=parse_error", { replace: true });
      }
    } else {
      navigate("/login?error=missing_token", { replace: true });
    }
  }, [navigate, params]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Inter, sans-serif", color: "#555" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🔄</div>
        <p>Completing sign-in...</p>
      </div>
    </div>
  );
}
