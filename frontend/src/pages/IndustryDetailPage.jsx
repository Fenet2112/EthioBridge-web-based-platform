import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./IndustryDetailPage.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

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

  useEffect(() => {
    const fetchIndustryDetails = async () => {
      const token = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        // First, refresh user status if stakeholder
        if (userData.role === "stakeholder") {
          const statusRes = await fetch(`${API_BASE_URL}/api/profile/stakeholder/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const dbStatus = statusData.status;
            
            // Decode JWT to check token status
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            const tokenStatus = tokenPayload.status;
            
            console.log('Status check - DB:', dbStatus, 'Token:', tokenStatus, 'LocalStorage:', userData.status);
            
            // Update localStorage if different from DB
            if (dbStatus && userData.status !== dbStatus) {
              userData.status = dbStatus;
              localStorage.setItem("user", JSON.stringify(userData));
              console.log('LocalStorage status updated to:', dbStatus);
            }
            
            // Show banner if DB status is approved but JWT token has old status
            if (dbStatus === "approved" && tokenStatus !== "approved") {
              console.log('JWT token needs refresh - showing banner');
              setNeedsSessionRefresh(true);
            }
          }
        }
        
        // Then fetch industry details
        const res = await fetch(`${API_BASE_URL}/api/industries/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

    fetchIndustryDetails();
  }, [id, navigate]);

  const handleBuyClick = (product) => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
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
        notes: formData.notes || null
      };
      
      // Add manual data for non-approved users
      if (!isApproved) {
        payload.full_name = formData.full_name;
        payload.organization_name = formData.organization_name;
        payload.phone = formData.phone;
        payload.location = formData.location;
      }
      
      console.log('Sending purchase request:', payload);
      
      const res = await fetch(`${API_BASE_URL}/api/purchases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      console.log('Response:', res.status, data);
      
      if (res.status === 400) {
        alert("Error: " + (data.message || "Bad request. Please check your input."));
        return;
      }
      
      if (res.status === 403) {
        // This shouldn't happen anymore since we removed requireApproved
        // But keep it for safety
        alert("Error: " + (data.message || "Access denied."));
        setShowBuyModal(false);
        return;
      }
      
      if (res.status === 404) {
        alert("Error: " + (data.message || "Resource not found."));
        setShowBuyModal(false);
        return;
      }
      
      if (!res.ok) throw new Error(data.message || "Failed to submit request");
      
      // Show appropriate success message
      if (isApproved) {
        alert("Purchase request sent to industry successfully! The industry can now see your request and contact you.");
      } else {
        alert("Purchase request submitted for admin verification! You will be notified once the admin approves your request.");
      }
      
      setShowBuyModal(false);
      setSelectedProduct(null);
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (loading) return <div className="detail-loading">Loading...</div>;
  if (error) return <div className="detail-error">Error: {error}</div>;
  if (!industry) return <div className="detail-error">Industry not found</div>;

  return (
    <div className="industry-detail-page">
      <button className="back-btn" onClick={() => navigate("/stakeholders")}>
        ← Back to Industries
      </button>

      {/* Session Refresh Banner */}
      {needsSessionRefresh && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}>
          <div>
            <strong>🎉 Your account has been approved!</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
              Please log out and log back in to refresh your session and access all features.
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.clear();
              navigate('/login');
            }}
            style={{
              background: 'white',
              color: '#667eea',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Log Out
          </button>
        </div>
      )}

      {/* Industry Profile Section */}
      <section className="industry-profile-section">
        <div className="profile-header">
          <div className="profile-icon-large">
            {industry.company_name?.charAt(0) || "🏭"}
          </div>
          <div className="profile-info">
            <h1>{industry.company_name}</h1>
            <p className="sector-badge">{industry.sector}</p>
          </div>
        </div>

        <div className="profile-details-grid">
          <div className="detail-item">
            <span className="detail-icon">📍</span>
            <span>{industry.location}</span>
          </div>
          {industry.phone && (
            <div className="detail-item">
              <span className="detail-icon">📞</span>
              <span>{industry.phone}</span>
            </div>
          )}
          {industry.website && (
            <div className="detail-item">
              <span className="detail-icon">🌐</span>
              <a href={industry.website} target="_blank" rel="noopener noreferrer">
                {industry.website}
              </a>
            </div>
          )}
          {industry.established_year && (
            <div className="detail-item">
              <span className="detail-icon">📅</span>
              <span>Established {industry.established_year}</span>
            </div>
          )}
        </div>

        {industry.description && (
          <div className="profile-description">
            <h3>About</h3>
            <p>{industry.description}</p>
          </div>
        )}
      </section>

      {/* Products Section */}
      <section className="products-section">
        <h2>Products & Services</h2>
        {products.length === 0 ? (
          <p className="no-products">This industry hasn't listed any products yet.</p>
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
                        {product.price.toLocaleString()} {product.unit !== "unit" ? `/ ${product.unit}` : ""}
                      </span>
                    )}
                    <button 
                      className="buy-btn"
                      onClick={() => handleBuyClick(product)}
                    >
                      Buy
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Buy Modal */}
      {showBuyModal && (
        <BuyModal 
          product={selectedProduct}
          onClose={() => setShowBuyModal(false)}
          onSubmit={handleBuySubmit}
        />
      )}
    </div>
  );
}

// ── Buy Modal Component ──
function BuyModal({ product, onClose, onSubmit }) {
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const isApproved = userData.status === "approved";
  
  const [formData, setFormData] = useState({
    quantity: 1,
    notes: "",
    // Fields for non-approved users
    full_name: "",
    organization_name: "",
    phone: "",
    location: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    onSubmit(formData);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="buy-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-modal" onClick={onClose}>×</button>
        <h2>Request Purchase</h2>
        <p className="product-name">Product: <strong>{product?.name}</strong></p>
        
        {isApproved ? (
          <div className="info-notice" style={{
            background: '#e3f2fd',
            border: '1px solid #2196f3',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#1565c0'
          }}>
            ℹ️ Your verified profile information will be sent to the industry automatically.
          </div>
        ) : (
          <div className="info-notice" style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#856404'
          }}>
            ⚠️ Please fill in your details below. This request will be sent to admin for verification.
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          {!isApproved && (
            <>
              <div className="form-group">
                <label>Full Name / Contact Person *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  required
                  style={{ fontSize: '14px', padding: '12px' }}
                />
              </div>

              <div className="form-group">
                <label>Organization Name *</label>
                <input
                  type="text"
                  name="organization_name"
                  value={formData.organization_name}
                  onChange={handleChange}
                  placeholder="Your company or organization"
                  required
                  style={{ fontSize: '14px', padding: '12px' }}
                />
              </div>

              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+251 911 000 000"
                  required
                  style={{ fontSize: '14px', padding: '12px' }}
                />
              </div>

              <div className="form-group">
                <label>Location / City *</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. Addis Ababa"
                  required
                  style={{ fontSize: '14px', padding: '12px' }}
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Quantity *</label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              min="1"
              required
              style={{ fontSize: '16px', padding: '12px' }}
            />
          </div>

          <div className="form-group">
            <label>Additional Notes (Optional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="4"
              placeholder="Any special requirements or questions for the industry..."
              style={{ fontSize: '14px', padding: '12px' }}
            />
          </div>

          <button type="submit" className="submit-buy-btn" disabled={loading}>
            {loading ? "Submitting..." : isApproved ? "Submit Purchase Request" : "Submit for Verification"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default IndustryDetailPage;
