import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SubscriptionModal from "./SubscriptionModal";
import IDVerificationModal from "./IDVerificationModal";
import { API_BASE_URL } from "../utils/api";
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
      <div className="detail-topbar">
        <button className="back-btn" onClick={() => navigate("/stakeholders")}>
          ← Back to Industries
        </button>
        {!subStatus.is_subscribed && (
          <div className="free-usage-badge">
            {subStatus.free_requests_used >= 1
              ? <span className="used">🔒 Free request used — <button onClick={() => setShowSubModal(true)}>Subscribe</button></span>
              : <span className="available">✓ 1 free request available</span>
            }
          </div>
        )}
        {subStatus.is_subscribed && (
          <div className="free-usage-badge subscribed">⭐ Subscribed</div>
        )}
      </div>

      {needsSessionRefresh && (
        <div className="session-banner">
          <div>
            <strong>🎉 Your account has been approved!</strong>
            <p>Please log out and log back in to refresh your session.</p>
          </div>
          <button onClick={() => { localStorage.clear(); navigate('/login'); }}>Log Out</button>
        </div>
      )}

      {/* Industry Profile */}
      <section className="industry-profile-section">
        <div className="profile-hero">
          <div className="profile-avatar-large">
            {industry.company_name?.charAt(0) || "🏭"}
          </div>
          <div className="profile-hero-info">
            <h1>{industry.company_name}</h1>
            <span className="sector-badge">{industry.sector}</span>
          </div>
        </div>

        <div className="profile-details-grid">
          <div className="detail-chip">
            <span>📍</span>
            <span className={isBlurred ? "blurred-text" : ""}>{isBlurred ? "Addis Ababa, Ethiopia" : industry.location}</span>
          </div>
          {industry.phone && (
            <div className="detail-chip">
              <span>📞</span>
              <span className={isBlurred ? "blurred-text" : ""}>{isBlurred ? "+251 9XX XXX XXX" : industry.phone}</span>
            </div>
          )}
          {industry.website && (
            <div className="detail-chip">
              <span>🌐</span>
              {isBlurred
                ? <span className="blurred-text">www.example.com</span>
                : <a href={industry.website} target="_blank" rel="noopener noreferrer">{industry.website}</a>
              }
            </div>
          )}
          {industry.established_year && (
            <div className="detail-chip">
              <span>📅</span>
              <span>Est. {industry.established_year}</span>
            </div>
          )}
        </div>

        {isBlurred && (
          <div className="blur-notice">
            🔒 Contact details are hidden. <button onClick={() => setShowSubModal(true)}>Subscribe to reveal</button>
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
                <div className="product-card-img-wrap">
                  {product.image_url && (
                    <img src={product.image_url} alt={product.name} className="product-image" />
                  )}
                  <div className="product-card-badges">
                    {product.is_new && <span className="badge-new">🆕 New</span>}
                    {product.is_popular && <span className="badge-popular">🔥 Popular</span>}
                    {product.discount_percentage > 0 && (
                      <span className="badge-discount">-{product.discount_percentage}% OFF</span>
                    )}
                  </div>
                </div>
                <div className="product-info">
                  <h3>{product.name}</h3>
                  {product.category && <span className="product-category">{product.category}</span>}
                  {product.description && <p className="product-desc">{product.description}</p>}
                  <div className="product-footer">
                    {product.price && (
                      <div className="product-price-wrap">
                        {product.discount_percentage > 0 ? (
                          <>
                            <span className="price-original">{Number(product.price).toLocaleString()} ETB</span>
                            <span className="price-discounted">{Number(product.discounted_price).toLocaleString()} ETB</span>
                          </>
                        ) : (
                          <span className="product-price">
                            {Number(product.price).toLocaleString()} ETB{product.unit !== "unit" ? ` / ${product.unit}` : ""}
                          </span>
                        )}
                      </div>
                    )}
                    <button className="buy-btn" onClick={() => handleBuyClick(product)}>
                      {isBlurred ? "🔒 Subscribe to Buy" : "Request Purchase"}
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
        <p className="modal-product-name">📦 <strong>{product?.name}</strong></p>

        {isApproved ? (
          <div className="modal-notice info">
            ✓ Your verified profile will be sent to the industry automatically.
          </div>
        ) : (
          <div className="modal-notice warning">
            ⚠️ Please fill in your details. This request will be reviewed by admin.
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
