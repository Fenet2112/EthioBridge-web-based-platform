import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Stakeholders from "./pages/Stakeholders";
import SignUp from "./pages/SignUp";
import Industry from "./pages/Industry";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import IndustryProfile from "./pages/IndustryProfile";
import StakeholderProfile from "./pages/StakeholderProfile";
import PendingApproval from "./pages/PendingApproval";
import IndustryDetailPage from "./pages/IndustryDetailPage";
import ProfilePage from "./pages/ProfilePage";
import StakeholderMessages from "./pages/StakeholderMessages";
import AccountStatus from "./pages/AccountStatus";
import Products from "./pages/Products";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Profile completion forms (after signup) */}
        <Route path="/profile/industry" element={<IndustryProfile />} />
        <Route path="/profile/stakeholder" element={<StakeholderProfile />} />

        {/* Pending approval waiting page */}
        <Route path="/pending" element={<PendingApproval />} />

        {/* Role dashboards (only accessible after approval) */}
        <Route path="/stakeholders" element={<Stakeholders />} />
        <Route path="/industry" element={<Industry />} />

        {/* Products Page */}
        <Route path="/products" element={<Products />} />

        {/* Stakeholder Messages */}
        <Route path="/messages" element={<StakeholderMessages />} />

        {/* Profile Page */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* Account Status Diagnostic */}
        <Route path="/account-status" element={<AccountStatus />} />

        {/* Industry Detail Page - for stakeholders to view industry and products */}
        <Route path="/industry/:id" element={<IndustryDetailPage />} />

        {/* Admin */}
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
