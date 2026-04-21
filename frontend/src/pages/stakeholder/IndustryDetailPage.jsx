import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SubscriptionModal from "../../components/SubscriptionModal";
import IDVerificationModal from "../../components/IDVerificationModal";
import { API_BASE_URL } from "../../utils/api";
import "./IndustryDetailPage.css";

function IndustryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [industry, setIndustry] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [needsSessionRefresh, setNeedsSessionRefresh] = useState(false);
  const [subStatus, setSubStatus] = useState({ can_request: true, free_requests_used: 0, is_subscribed: false });
  const [showSubModal, setShowSubModal] = useState(false);
  const [showIDModal, setShowIDModal] = useState(false);
  const [pendingVerificationRequestId, setPendingVerificationRequestId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      if (!token) { navigate("/login"); return; }

      try {
        if (userData.role === "stakeholder") {
          // Refresh status
          const statusRes = await fetch(`${API_BASE_URL}/api/profile/stakeholder/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status && userData.status !== statusData.status) {
              userData.status = statusData.status;
              localStorage.setItem("user", JSON.stringify(userData));
            }
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            if (statusData.status === "approved" && tokenPayload.status !== "approved") {
              setNeedsSessionRefresh(true);
            }
          }

          // Fetch subscription status
          const subRes = await fetch(`${API_BASE_URL}/api/subscription/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (subRes.ok) {
            const subData = await subRes.json();
            setSubStatus(subData);
          }
        }

        const res = await fetch(`${API_BASE_URL}/api/industries/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch industry details");
        setIndustry(data.industry);
        setProducts(data.products);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  const handleBuyClick = (product) => {
    if (!subStatus.can_request) {
      setShowSubModal(true);
      return;
    }
    setSelectedProduct(product);
    setShowBuyModal(true);
  };

  const handleBuySubmit = async (formData) => {
    const token = localStorage.getItem("token");
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const isApproved = userData.status === "approved";

    try {
      const payload = {
        industry_id: parseInt(id),
        product_id: selectedProduct.id,
        quantity: parseInt(formData.quantity),
        notes: formData.notes || null,
      };
      if (!isApproved) {
        payload.full_name = formData.full_name;
        payload.organization_name = formData.organization_name;
        payload.phone = formData.phone;
        payload.location = formData.location;
      }

      const res = await fetch(`${API_BASE_URL}/api/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.status === 402) {
        setShowBuyModal(false);
        setShowSubModal(true);
        return;
      }
      if (!res.ok) throw new Error(data.message || "Failed to submit request");

      // If first-time request needs ID verification
      if (data.requires_verification && data.request?.id) {
        setShowBuyModal(false);
        setPendingVerificationRequestId(data.request.id);
        setShowIDModal(true);
        return;
      }

      // Update local sub status
      setSubStatus(prev => ({
        ...prev,
        free_requests_used: prev.free_requests_used + 1,
        can_request: prev.is_subscribed || prev.free_requests_used + 1 < 1,
      }));

      alert(isApproved
        ? "Purchase request sent to industry successfully!"
        : "Purchase request submitted for admin verification!");
      setShowBuyModal(false);
      setSelectedProduct(null);
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (loading) return (
    <div className="detail-loading">
      <div className="loading-spinner"></div>
      <p>Loading industry details...</p>
    </div>
  );
  if (error) return <div className="detail-error">⚠️ {error}</div>;
  if (!industry) return <div className="detail-error">Industry not found</div>;

  const isBlurred = !subStatus.can_request;

  return (
    <div className="industry-detail-page">
      <StakeholderNav />
      
      <div className="detail-topbar">
        <button className="back-btn" onClick={() => navigate("/stakeholders")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>
        {!subStatus.is_subscribed && (
          <div className="free-usage-badge">
            {subStatus.free_requests_used >= 1
              ? <span className="used">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Free request used — <button onClick={() => setShowSubModal(true)}>Subscribe</button>
                </span>
              : <span className="available">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  1 free request available
                </span>
            }
          </div>
        )}
        {subStatus.is_subscribed && (
          <div className="free-usage-badge subscribed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Subscribed
          </div>
        )}
      </div>

      {needsSessionRefresh && (
        <div className="session-banner">
          <div>
            <strong>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Your account has been approved!
            </strong>
            <p>Please log out and log back in to refresh your session.</p>
          </div>
          <button onClick={() => { localStorage.clear(); navigate('/login'); }}>Log Out</button>
        </div>
      )}

      {/* Industry Profile */}
      <section className="industry-profile-section">
        <div className="profile-hero">
          <div className="profile-avatar-large">
            {industry.company_name?.charAt(0) || "I"}
          </div>
          <div className="profile-hero-info">
            <h1>{industry.company_name}</h1>
            <span className="sector-badge">{industry.sector}</span>
          </div>
          <button className="message-industry-btn" onClick={() => navigate(`/stakeholders`)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Message
          </button>
        </div>

        <div className="profile-details-grid">
          <div className="detail-chip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span className={isBlurred ? "blurred-text" : ""}>{isBlurred ? "Addis Ababa, Ethiopia" : industry.location}</span>
          </div>
          {industry.phone && (
            <div className="detail-chip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span className={isBlurred ? "blurred-text" : ""}>{isBlurred ? "+251 9XX XXX XXX" : industry.phone}</span>
            </div>
          )}
          {industry.website && (
            <div className="detail-chip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              {isBlurred
                ? <span className="blurred-text">www.example.com</span>
                : <a href={industry.website} target="_blank" rel="noopener noreferrer">{industry.website}</a>
              }
            </div>
          )}
          {industry.established_year && (
            <div className="detail-chip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>Est. {industry.established_year}</span>
            </div>
          )}
        </div>

        {isBlurred && (
          <div className="blur-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Contact details are hidden. <button onClick={() => setShowSubModal(true)}>Subscribe to reveal</button>
          </div>
        )}

        {industry.description && (
          <div className="profile-description">
            <h3>About</h3>
            <p>{industry.description}</p>
          </div>
        )}
      </section>

      {/* Products */}
      <section className="products-section">
        <h2>Products & Services</h2>
        {products.length === 0 ? (
          <p className="no-products">No products listed yet.</p>
        ) : (
          <div className="products-grid">
            {products.map((product) => (
              <div key={product.id} className="product-card">
                {product.image_url && (
                  <img src={product.image_url} alt={product.name} className="product-image" />
                )}
                <div className="product-info">
                  <h3>{product.name}</h3>
                  {product.category && <span className="product-category">{product.category}</span>}
                  {product.description && <p className="product-desc">{product.description}</p>}
                  <div className="product-footer">
                    {product.price && (
                      <span className="product-price">
                        {product.price.toLocaleString()} ETB{product.unit !== "unit" ? ` / ${product.unit}` : ""}
                      </span>
                    )}
                    <button className="buy-btn" onClick={() => handleBuyClick(product)}>
                      {isBlurred ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                          Subscribe to Buy
                        </>
                      ) : "Request Purchase"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showBuyModal && (
        <BuyModal
          product={selectedProduct}
          onClose={() => setShowBuyModal(false)}
          onSubmit={handleBuySubmit}
        />
      )}

      {showSubModal && (
        <SubscriptionModal
          onClose={() => setShowSubModal(false)}
          onSuccess={() => {
            setShowSubModal(false);
            setSubStatus(prev => ({ ...prev, is_subscribed: true, can_request: true }));
            alert("Subscription activated! You now have unlimited access.");
          }}
        />
      )}

      {showIDModal && pendingVerificationRequestId && (
        <IDVerificationModal
          requestId={pendingVerificationRequestId}
          onClose={() => { setShowIDModal(false); setPendingVerificationRequestId(null); }}
          onSuccess={(msg) => {
            setShowIDModal(false);
            setPendingVerificationRequestId(null);
            setSubStatus(prev => ({
              ...prev,
              free_requests_used: prev.free_requests_used + 1,
              can_request: prev.is_subscribed || prev.free_requests_used + 1 < 1,
            }));
            alert(msg || "ID submitted! Your request is under review. You'll be notified once approved.");
          }}
        />
      )}
    </div>
  );
}

function BuyModal({ product, onClose, onSubmit }) {
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const isApproved = userData.status === "approved";
  const [formData, setFormData] = useState({ quantity: 1, notes: "", full_name: "", organization_name: "", phone: "", location: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(formData);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="buy-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-modal" onClick={onClose}>✕</button>
        <h2>Request Purchase</h2>
        <p className="modal-product-name">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <strong>{product?.name}</strong>
        </p>

        {isApproved ? (
          <div className="modal-notice info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Your verified profile will be sent to the industry automatically.
          </div>
        ) : (
          <div className="modal-notice warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Please fill in your details. This request will be reviewed by admin.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isApproved && (
            <>
              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} placeholder="Your full name" required />
              </div>
              <div className="form-group">
                <label>Organization *</label>
                <input type="text" name="organization_name" value={formData.organization_name} onChange={handleChange} placeholder="Your company or organization" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone *</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+251 9XX XXX XXX" required />
                </div>
                <div className="form-group">
                  <label>Location *</label>
                  <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="City" required />
                </div>
              </div>
            </>
          )}
          <div className="form-group">
            <label>Quantity *</label>
            <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} min="1" required />
          </div>
          <div className="form-group">
            <label>Notes (Optional)</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" placeholder="Any special requirements..." />
          </div>
          <button type="submit" className="submit-buy-btn" disabled={loading}>
            {loading ? "Submitting..." : isApproved ? "Send Purchase Request" : "Submit for Verification"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default IndustryDetailPage;
