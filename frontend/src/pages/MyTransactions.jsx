import StakeholderNav from "../components/StakeholderNav";
import TransactionHistory from "../components/TransactionHistory";

export default function MyTransactions() {
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <StakeholderNav />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, color: "#1f2937" }}>
            My Purchase History
          </h1>
          <p style={{ margin: "6px 0 0", color: "#9ca3af", fontSize: ".9rem" }}>
            All your purchase requests and their current status
          </p>
        </div>
        <TransactionHistory role="stakeholder" />
      </div>
    </div>
  );
}
