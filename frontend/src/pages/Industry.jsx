import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "./Industry.css";
import "./IndustryMessages.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
let socket;

function Industry() {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("profile");

  // Profile status from API
  const [profileStatus, setProfileStatus] = useState("incomplete");
  const [loading, setLoading] = useState(true);

  // Products state
  const [products, setProducts] = useState([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: "", description: "", price: "", unit: "unit", category: ""
  });

  // Purchase requests state
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Messaging state
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const menuItems = [
    { id: "profile", label: "Manage Profile", icon: "👤" },
    { id: "products", label: "Manage Product Listings", icon: "📦" },
    { id: "requests", label: "Purchase Requests", icon: "📋" },
    { id: "messages", label: "Communicate with Stakeholders", icon: "💬" },
  ];

  const [profile, setProfile] = useState({
    companyName: "",
    industryType: "",
    location: "",
    phone: "",
    email: "",
    website: "",
    description: "",
    licenseNumber: "",
    logoPreview: null,
  });

  const [isEditing, setIsEditing] = useState(true);

  // Check auth and profile status on load
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    
    if (!token) {
      navigate("/login");
      return;
    }

    // Check profile status and load profile data
    fetch(`${API_BASE_URL}/api/profile/industry/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.status) {
        setProfileStatus(data.status);
        
        // Update localStorage if status changed
        if (userData.status !== data.status) {
          userData.status = data.status;
          localStorage.setItem("user", JSON.stringify(userData));
        }
        
        // Load profile data if it exists
        if (data.profile) {
          setProfile({
            companyName: data.profile.company_name || "",
            industryType: data.profile.sector || "",
            location: data.profile.location || "",
            phone: data.profile.phone || "",
            email: userData.email || "",
            website: data.profile.website || "",
            description: data.profile.description || "",
            licenseNumber: "", // Not stored in industries table yet
            logoPreview: null,
          });
          
          // If profile exists and is approved, show view mode
          if (data.status === "approved") {
            setIsEditing(false);
          }
        }
      }
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, [navigate]);

  // Fetch products when products section is active
  useEffect(() => {
    if (activeSection === "products" && profileStatus === "approved") {
      const token = localStorage.getItem("token");
      fetch(`${API_BASE_URL}/api/my-products`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        // Ensure data is an array
        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          console.error("Products data is not an array:", data);
          setProducts([]);
        }
      })
      .catch(err => {
        console.error("Failed to load products:", err);
        setProducts([]);
      });
    }
  }, [activeSection, profileStatus]);

  // Fetch purchase requests when requests section is active
  useEffect(() => {
    if (activeSection === "requests" && profileStatus === "approved") {
      setRequestsLoading(true);
      const token = localStorage.getItem("token");
      fetch(`${API_BASE_URL}/api/purchases/industry-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setPurchaseRequests(data))
      .catch(err => console.error("Failed to load requests:", err))
      .finally(() => setRequestsLoading(false));
    }
  }, [activeSection, profileStatus]);

  // Fetch conversations when messages section is active
  useEffect(() => {
    if (activeSection === "messages" && profileStatus === "approved") {
      loadConversations();
    }
  }, [activeSection, profileStatus]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Socket.IO setup for real-time messaging
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    
    if (userData.id && profileStatus === "approved") {
      socket = io(API_BASE_URL);
      
      socket.on('connect', () => {
        console.log('Industry socket connected:', socket.id);
        socket.emit('join', userData.id);
      });

      socket.on('receive_message', (data) => {
        console.log('Industry received message:', data);
        
        // Add message to current conversation if it's open
        if (selectedConversation && data.conversationId === selectedConversation.id) {
          const newMsg = {
            id: Date.now(),
            content: data.message,
            sender_id: data.senderId,
            sender_role: 'stakeholder',
            created_at: data.timestamp,
          };
          setMessages((prev) => [...prev, newMsg]);
        }
        
        // Update unread count and conversation list
        loadConversations();
      });

      return () => {
        if (socket) socket.disconnect();
      };
    }
  }, [profileStatus, selectedConversation]);

  const loadConversations = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setConversations(data);
      
      // Calculate total unread count
      const total = data.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
      setUnreadCount(total);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  };

  const loadMessages = async (conversation) => {
    setSelectedConversation(conversation);
    setMessagesLoading(true);
    const token = localStorage.getItem("token");
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/conversations/${conversation.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(data);
      
      // Reload conversations to update unread count
      loadConversations();
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const token = localStorage.getItem("token");
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const messageText = newMessage;
    
    // Optimistically add message to UI
    const tempMsg = {
      id: Date.now(),
      content: messageText,
      sender_id: userData.id,
      sender_role: 'industry',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage("");

    try {
      // Save to database
      await fetch(`${API_BASE_URL}/api/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: messageText })
      });

      // Send via Socket.IO
      if (socket && socket.connected) {
        socket.emit('send_message', {
          conversationId: selectedConversation.id,
          senderId: userData.id,
          receiverId: selectedConversation.stakeholder_user_id,
          message: messageText
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  const openConversationWithStakeholder = async (stakeholderId) => {
    const token = localStorage.getItem("token");
    
    try {
      // Get industry ID
      const industryRes = await fetch(`${API_BASE_URL}/api/profile/industry/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const industryData = await industryRes.json();
      
      if (!industryData.profile || !industryData.profile.id) {
        alert("Industry profile not found");
        return;
      }
      
      // Create or get conversation
      const convRes = await fetch(`${API_BASE_URL}/api/conversations/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          stakeholder_id: stakeholderId,
          industry_id: industryData.profile.id
        })
      });
      
      const convData = await convRes.json();
      
      // Switch to messages section
      setActiveSection("messages");
      
      // Reload conversations and open the one we just created/found
      await loadConversations();
      
      setTimeout(() => {
        const conversation = conversations.find(c => c.stakeholder_id === stakeholderId);
        if (conversation) {
          loadMessages(conversation);
        }
      }, 500);
      
    } catch (error) {
      console.error("Failed to open conversation:", error);
      alert("Failed to open conversation. Please try again.");
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile((prev) => ({ ...prev, logoPreview: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/industry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userData.id,
          company_name: profile.companyName,
          sector: profile.industryType,
          location: profile.location,
          description: profile.description,
          phone: profile.phone,
          website: profile.website,
          established_year: null // Add this field to the form if needed
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit profile");
      }
      
      if (profileStatus === "incomplete") {
        // Update user status in localStorage
        userData.status = "pending";
        localStorage.setItem("user", JSON.stringify(userData));
        
        alert("Profile submitted for admin approval!");
        setProfileStatus("pending");
      } else {
        alert("Profile updated successfully!");
      }
      
      setIsEditing(false);
      
      // Reload profile data
      const statusRes = await fetch(`${API_BASE_URL}/api/profile/industry/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const statusData = await statusRes.json();
      if (statusData.status) {
        setProfileStatus(statusData.status);
        
        // Update localStorage with new status
        userData.status = statusData.status;
        localStorage.setItem("user", JSON.stringify(userData));
      }
    } catch (error) {
      alert("Error: " + error.message);
      console.error("Profile submission error:", error);
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const canAccessOtherSections = profileStatus === "approved";
  const showPendingBanner = profileStatus === "pending";

  // ── Product CRUD Handlers ──
  const handleProductFormChange = (e) => {
    const { name, value } = e.target;
    setProductForm(prev => ({ ...prev, [name]: value }));
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const url = editingProduct 
      ? `${API_BASE_URL}/api/products/${editingProduct.id}`
      : `${API_BASE_URL}/api/products`;
    const method = editingProduct ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(productForm)
      });
      
      if (res.status === 403) {
        alert("Your account needs to be approved by admin before you can add products. Please log out and log back in after admin approval to refresh your session.");
        return;
      }
      
      if (!res.ok) throw new Error("Failed to save product");
      
      // Refresh products
      const productsRes = await fetch(`${API_BASE_URL}/api/my-products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const productsData = await productsRes.json();
      setProducts(productsData);
      
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm({ name: "", description: "", price: "", unit: "unit", category: "" });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || "",
      description: product.description || "",
      price: product.price || "",
      unit: product.unit || "unit",
      category: product.category || ""
    });
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete product");
      setProducts(products.filter(p => p.id !== productId));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="industry-dashboard">Loading...</div>;

  return (
    <div className="industry-dashboard">
      {/* Navbar */}
      <nav className="dashboard-navbar">
        <div className="nav-left">
          <button
            className={`hamburger-btn ${isMenuOpen ? "active" : ""}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
          </button>
          <h2 className="dashboard-logo">EthioBridge Industry</h2>
        </div>
        <div className="nav-right">
          <span className="welcome-text">Welcome back</span>
          <div className="user-avatar">🏭</div>
        </div>
      </nav>

      {/* Sidebar */}
      <div className={`sidebar-menu ${isMenuOpen ? "open" : ""}`}>
        <div className="sidebar-top-spacer"></div>

        <div className="sidebar-profile">
          {profile.logoPreview ? (
            <img src={profile.logoPreview} alt="Company Logo" className="sidebar-avatar" />
          ) : (
            <div className="sidebar-avatar-placeholder">
              {profile.companyName ? profile.companyName.charAt(0).toUpperCase() : "C"}
            </div>
          )}
          <div className="sidebar-profile-info">
            <h4>{profile.companyName || "Your Company"}</h4>
            <p>{profile.industryType || "Industry"}</p>
          </div>
        </div>

        <div className="sidebar-header">
          <h3>Menu</h3>
          <button className="close-btn" onClick={() => setIsMenuOpen(false)}>✕</button>
        </div>

        <ul className="menu-list">
          <li
            className={`menu-item ${activeSection === "profile" ? "active" : ""}`}
            onClick={() => {
              setActiveSection("profile");
              setIsMenuOpen(false);
            }}
          >
            <span className="menu-icon">👤</span>
            <span>Manage Profile</span>
          </li>

          {canAccessOtherSections &&
            menuItems
              .filter(item => item.id !== "profile")
              .map(item => (
                <li
                  key={item.id}
                  className={`menu-item ${activeSection === item.id ? "active" : ""}`}
                  onClick={() => {
                    setActiveSection(item.id);
                    setIsMenuOpen(false);
                  }}
                >
                  <span className="menu-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </li>
              ))}
        </ul>

        <div className="sidebar-footer">
          <Link to="/" className="logout-btn">Logout</Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-header">
          <h1>
            {menuItems.find(item => item.id === activeSection)?.label || "Dashboard"}
          </h1>
          <p>Manage your business profile and operations</p>
        </div>

        {/* Pending Approval Banner */}
        {activeSection === "profile" && showPendingBanner && (
          <div className="pending-banner">
            <div className="banner-icon">⏳</div>
            <div className="banner-content">
              <h3>Profile Under Review</h3>
              <p>
                Thank you! Your company profile has been submitted and is now under review by our admin team.
                Approval usually takes 1–3 business days. You'll receive an email once it's approved.
              </p>
            </div>
          </div>
        )}

        {/* Profile Section */}
        {activeSection === "profile" && (
          <div className="profile-card">
            {isEditing ? (
              <>
                <h2>{profileStatus !== "incomplete" ? "Update Your Profile" : "Complete Your Company Profile"}</h2>
                <p>
                  {profileStatus !== "incomplete"
                    ? "Make changes to your profile"
                    : "Please fill in your company details to get started"}
                </p>

                <form onSubmit={handleProfileSubmit} className="profile-form">
                  <div className="form-group logo-group">
                    <label>Company Logo</label>
                    <div className="logo-preview-container">
                      {profile.logoPreview ? (
                        <img src={profile.logoPreview} alt="Logo preview" className="logo-preview" />
                      ) : (
                        <div className="logo-placeholder">Upload Logo</div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="logo-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="companyName">Company / Industry Name *</label>
                    <input
                      type="text"
                      id="companyName"
                      name="companyName"
                      value={profile.companyName}
                      onChange={handleProfileChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="industryType">Industry Type *</label>
                    <select
                      id="industryType"
                      name="industryType"
                      value={profile.industryType}
                      onChange={handleProfileChange}
                      required
                    >
                      <option value="">Select type</option>
                      <option>Cement Manufacturer</option>
                      <option>Steel & Metal Producer</option>
                      <option>Construction Materials Supplier</option>
                      <option>Electrical & Lighting</option>
                      <option>Plumbing & Sanitary</option>
                      <option>Machinery & Equipment</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="location">Location *</label>
                    <input
                      type="text"
                      id="location"
                      name="location"
                      value={profile.location}
                      onChange={handleProfileChange}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="phone">Phone Number *</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={profile.phone}
                        onChange={handleProfileChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="email">Email *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={profile.email}
                        onChange={handleProfileChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="website">Website / Online Store</label>
                    <input
                      type="url"
                      id="website"
                      name="website"
                      value={profile.website}
                      onChange={handleProfileChange}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="description">Company Description</label>
                    <textarea
                      id="description"
                      name="description"
                      value={profile.description}
                      onChange={handleProfileChange}
                      rows="5"
                      placeholder="Tell others about your company, experience, specialties..."
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="licenseNumber">Registration / License Number *</label>
                    <input
                      type="text"
                      id="licenseNumber"
                      name="licenseNumber"
                      value={profile.licenseNumber}
                      onChange={handleProfileChange}
                      required
                    />
                  </div>

                  <button type="submit" className="save-profile-btn">
                    {profileStatus === "incomplete" ? "Submit for Approval" : "Update Profile"}
                  </button>
                </form>
              </>
            ) : (
              <div className="profile-view">
                <div className="profile-header">
                  {profile.logoPreview ? (
                    <img src={profile.logoPreview} alt="Company Logo" className="company-logo" />
                  ) : (
                    <div className="logo-placeholder-view">No Logo</div>
                  )}
                  <div className="profile-title">
                    <h2>{profile.companyName || "Company Name"}</h2>
                    <p className="industry-type">{profile.industryType || "Industry Type"}</p>
                  </div>
                  <button className="edit-btn" onClick={handleEditClick}>
                    Edit Profile
                  </button>
                </div>

                <div className="profile-details">
                  <div className="detail-item">
                    <strong>Location:</strong> {profile.location || "Not set"}
                  </div>
                  <div className="detail-item">
                    <strong>Phone:</strong> {profile.phone || "Not set"}
                  </div>
                  <div className="detail-item">
                    <strong>Email:</strong> {profile.email || "Not set"}
                  </div>
                  {profile.website && (
                    <div className="detail-item">
                      <strong>Website:</strong>{" "}
                      <a href={profile.website} target="_blank" rel="noopener noreferrer">
                        {profile.website}
                      </a>
                    </div>
                  )}
                  <div className="detail-item">
                    <strong>License/Registration:</strong> {profile.licenseNumber || "Not set"}
                  </div>
                  <div className="detail-item full-width">
                    <strong>About Us:</strong>
                    <p>{profile.description || "No description added yet."}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Locked message for non-approved users */}
        {!canAccessOtherSections && activeSection !== "profile" && (
          <div className="locked-section">
            <h2>Account Not Yet Approved</h2>
            <p>
              This section will unlock after your company profile is reviewed and approved by our admin team.
            </p>
            <p>Approval usually takes 1–3 business days. You can continue editing your profile in the meantime.</p>
          </div>
        )}

        {/* Products Section - CRUD */}
        {canAccessOtherSections && activeSection === "products" && (
          <div className="products-section">
            <div className="section-header">
              <h2>Manage Product Listings</h2>
              <button 
                className="add-product-btn"
                onClick={() => {
                  setShowProductForm(true);
                  setEditingProduct(null);
                  setProductForm({ name: "", description: "", price: "", unit: "unit", category: "" });
                }}
              >
                + Add Product
              </button>
            </div>

            {/* Session Refresh Notice */}
            <div className="info-banner" style={{
              background: '#e3f2fd',
              border: '1px solid #2196f3',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>ℹ️</span>
              <p style={{ margin: 0, fontSize: '14px', color: '#1565c0' }}>
                <strong>Note:</strong> If you were recently approved by admin and can't add products, please log out and log back in to refresh your session.
              </p>
            </div>

            {/* Product Form Modal */}
            {showProductForm && (
              <div className="product-form-card">
                <h3>{editingProduct ? "Edit Product" : "Add New Product"}</h3>
                <form onSubmit={handleProductSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Product Name *</label>
                      <input
                        type="text"
                        name="name"
                        value={productForm.name}
                        onChange={handleProductFormChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <input
                        type="text"
                        name="category"
                        value={productForm.category}
                        onChange={handleProductFormChange}
                        placeholder="e.g. Cement, Steel, Wood"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Price</label>
                      <input
                        type="number"
                        name="price"
                        value={productForm.price}
                        onChange={handleProductFormChange}
                        step="0.01"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="form-group">
                      <label>Unit</label>
                      <select name="unit" value={productForm.unit} onChange={handleProductFormChange}>
                        <option value="unit">Per Unit</option>
                        <option value="kg">Per kg</option>
                        <option value="ton">Per ton</option>
                        <option value="bag">Per bag</option>
                        <option value="piece">Per piece</option>
                        <option value="meter">Per meter</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={productForm.description}
                      onChange={handleProductFormChange}
                      rows="3"
                    />
                  </div>
                  <div className="form-actions">
                    <button type="button" className="cancel-btn" onClick={() => setShowProductForm(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="save-btn">
                      {editingProduct ? "Update Product" : "Add Product"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Products List */}
            {!Array.isArray(products) || products.length === 0 ? (
              <p className="no-products">No products yet. Add your first product!</p>
            ) : (
              <div className="products-grid">
                {products.map(product => (
                  <div key={product.id} className="product-item-card">
                    <h4>{product.name}</h4>
                    <p className="product-category">{product.category}</p>
                    {product.description && <p className="product-desc">{product.description}</p>}
                    <div className="product-price">
                      {product.price ? `${product.price.toLocaleString()} / ${product.unit}` : "Price on request"}
                    </div>
                    <div className="product-actions">
                      <button onClick={() => handleEditProduct(product)}>Edit</button>
                      <button className="delete-btn" onClick={() => handleDeleteProduct(product.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Purchase Requests Section */}
        {canAccessOtherSections && activeSection === "requests" && (
          <div className="requests-section">
            <div style={{marginBottom: '30px'}}>
              <h2 style={{marginBottom: '8px'}}>Purchase Requests</h2>
              <p style={{color: '#666', fontSize: '14px'}}>Requests from stakeholders who want to buy your products</p>
            </div>

            {requestsLoading ? (
              <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>
                <div style={{fontSize: '40px', marginBottom: '10px'}}>⏳</div>
                <p>Loading requests...</p>
              </div>
            ) : purchaseRequests.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: '#f8f9fa',
                borderRadius: '12px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{fontSize: '60px', marginBottom: '15px'}}>📋</div>
                <h3 style={{color: '#6c757d', marginBottom: '8px'}}>No Purchase Requests Yet</h3>
                <p style={{color: '#adb5bd', fontSize: '14px'}}>When stakeholders request your products, they'll appear here</p>
              </div>
            ) : (
              <div style={{display: 'grid', gap: '20px'}}>
                {purchaseRequests.map(req => (
                  <div key={req.id} style={{
                    background: 'white',
                    border: '1px solid #e9ecef',
                    borderRadius: '12px',
                    padding: '24px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}>
                    {/* Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '20px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid #f1f3f5'
                    }}>
                      <div>
                        <h4 style={{
                          margin: '0 0 8px',
                          fontSize: '20px',
                          color: '#212529',
                          fontWeight: '600'
                        }}>
                          📦 {req.product_name}
                        </h4>
                        <div style={{
                          display: 'inline-block',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          ✓ Approved
                        </div>
                      </div>
                      <div style={{
                        background: '#f8f9fa',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        textAlign: 'center'
                      }}>
                        <div style={{fontSize: '24px', fontWeight: '700', color: '#495057'}}>
                          {req.quantity}
                        </div>
                        <div style={{fontSize: '12px', color: '#6c757d', marginTop: '2px'}}>
                          {req.unit}
                        </div>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px',
                      marginBottom: '20px'
                    }}>
                      <div>
                        <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '4px'}}>
                          👤 Stakeholder
                        </div>
                        <div style={{fontWeight: '500', color: '#212529'}}>{req.full_name}</div>
                      </div>
                      <div>
                        <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '4px'}}>
                          🏢 Organization
                        </div>
                        <div style={{fontWeight: '500', color: '#212529'}}>{req.organization_name}</div>
                      </div>
                      <div>
                        <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '4px'}}>
                          📞 Phone
                        </div>
                        <div style={{fontWeight: '500', color: '#212529'}}>
                          <a href={`tel:${req.phone}`} style={{color: '#667eea', textDecoration: 'none'}}>
                            {req.phone}
                          </a>
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '4px'}}>
                          📍 Location
                        </div>
                        <div style={{fontWeight: '500', color: '#212529'}}>{req.location}</div>
                      </div>
                    </div>

                    {/* Notes */}
                    {req.notes && (
                      <div style={{
                        background: '#f8f9fa',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        marginBottom: '16px'
                      }}>
                        <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '4px'}}>
                          📝 Additional Notes
                        </div>
                        <div style={{fontSize: '14px', color: '#495057', lineHeight: '1.5'}}>
                          {req.notes}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{display: 'flex', gap: '10px'}}>
                      <button 
                        onClick={() => openConversationWithStakeholder(req.stakeholder_id)}
                        style={{
                          flex: 1,
                          padding: '12px 24px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                        }}
                      >
                        💬 Message Stakeholder
                      </button>
                      <button 
                        onClick={() => window.location.href = `tel:${req.phone}`}
                        style={{
                          padding: '12px 24px',
                          background: 'white',
                          color: '#667eea',
                          border: '2px solid #667eea',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = '#667eea';
                          e.target.style.color = 'white';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = 'white';
                          e.target.style.color = '#667eea';
                        }}
                      >
                        📞 Call
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages Section */}
        {canAccessOtherSections && activeSection === "messages" && (
          <div className="messages-section">
            <h2>Communicate with Stakeholders {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}</h2>
            
            <div className="messages-container">
              {/* Conversations List */}
              <div className="conversations-list">
                <h3>Conversations</h3>
                {conversations.length === 0 ? (
                  <p className="no-conversations">No conversations yet. Stakeholders will appear here when they message you.</p>
                ) : (
                  conversations.map(conv => (
                    <div
                      key={conv.id}
                      className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                      onClick={() => loadMessages(conv)}
                    >
                      <div className="conv-avatar">{conv.organization_name?.charAt(0) || 'S'}</div>
                      <div className="conv-info">
                        <h4>{conv.organization_name}</h4>
                        <p className="last-message">{conv.last_message || 'No messages yet'}</p>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="unread-count">{conv.unread_count}</span>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Messages Area */}
              <div className="messages-area">
                {!selectedConversation ? (
                  <div className="no-conversation-selected">
                    <p>Select a conversation to start messaging</p>
                  </div>
                ) : (
                  <>
                    <div className="messages-header">
                      <div className="stakeholder-info">
                        <div className="stakeholder-avatar">{selectedConversation.organization_name?.charAt(0) || 'S'}</div>
                        <div>
                          <h3>{selectedConversation.organization_name}</h3>
                          <p>{selectedConversation.organization_type}</p>
                        </div>
                      </div>
                    </div>

                    <div className="messages-list">
                      {messagesLoading ? (
                        <p>Loading messages...</p>
                      ) : messages.length === 0 ? (
                        <p className="no-messages">No messages yet. Start the conversation!</p>
                      ) : (
                        <>
                          {messages.map(msg => (
                            <div
                              key={msg.id}
                              className={`message-bubble ${msg.sender_role === 'industry' ? 'sent' : 'received'}`}
                            >
                              <div className="message-content">{msg.content}</div>
                              <div className="message-time">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </>
                      )}
                    </div>

                    <div className="message-input-area">
                      <input
                        type="text"
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      />
                      <button onClick={sendMessage} disabled={!newMessage.trim()}>
                        Send
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Industry;
