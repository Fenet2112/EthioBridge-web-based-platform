import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { 
  FaHome, FaUser, FaBox, FaClipboardList, FaComments, FaChartBar,
  FaIndustry, FaQuestionCircle, FaTimes, FaLock, FaClock, FaCheckCircle,
  FaHandshake, FaShieldAlt, FaCheck, FaTimes as FaTimesCircle, FaPlus,
  FaStar, FaExclamationTriangle, FaInfoCircle, FaPhone, FaMapMarkerAlt,
  FaEnvelope, FaBuilding, FaCalendar, FaBell
} from "react-icons/fa";
import { API_BASE_URL } from "../utils/api";
import SubscriptionModal from "../components/SubscriptionModal";
import TransactionHistory from "../components/TransactionHistory";
import { imageUrl } from "../utils/imageUrl";
import "./Industry.css";
import "./IndustryDarkMode.css";
import "./IndustryMessages.css";
const FREE_PRODUCT_LIMIT = 5;
let socket;

function Industry() {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");

  // Profile status from API
  const [profileStatus, setProfileStatus] = useState("incomplete");
  const [loading, setLoading] = useState(true);

  // Subscription state
  const [subStatus, setSubStatus] = useState(null);
  const [showSubModal, setShowSubModal] = useState(false);

  // Products state
  const [products, setProducts] = useState([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: "", description: "", price: "", unit: "unit", category: "", discount_percentage: ""
  });
  const [productNameError, setProductNameError] = useState("");
  const [productImage, setProductImage] = useState(null);       // File object
  const [productImagePreview, setProductImagePreview] = useState(null); // base64 preview
  const productImageRef = useRef(null);

  // Purchase requests state
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Dashboard state
  const [dashSummary, setDashSummary] = useState(null);
  const [dashRequests, setDashRequests] = useState([]);
  const [dashProducts, setDashProducts] = useState([]);
  const [dashLoading, setDashLoading] = useState(false);

  // Messaging state
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const fileInputRef = useRef(null);

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [notifsLoading, setNotifsLoading] = useState(false);

  const menuItems = [
    { id: "dashboard", label: "Dashboard",                   icon: <FaHome /> },
    { id: "profile",   label: "Manage Profile",              icon: <FaUser /> },
    { id: "products",  label: "Manage Product Listings",     icon: <FaBox /> },
    { id: "requests",  label: "Purchase Requests",           icon: <FaClipboardList /> },
    { id: "messages",  label: "Communicate with Stakeholders", icon: <FaComments /> },
    { id: "analytics", label: "Analytics",                   icon: <FaChartBar /> },
  ];

  const [profile, setProfile] = useState({
    companyName: "",
    industryType: "",
    businessRole: "",
    location: "",
    phone: "",
    email: "",
    website: "",
    description: "",
    licenseNumber: "",
    logoPreview: null,
    latitude: null,
    longitude: null,
  });

  // GPS detection state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState(""); // "detected" | "denied" | ""

  const [isEditing, setIsEditing] = useState(true);
  // Check auth and profile status on load
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    
    if (!token) {
      navigate("/login");
      return;
    }

    // Fetch subscription status
    fetch(`${API_BASE_URL}/api/subscription/status`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(setSubStatus).catch(() => {});

    // Check profile status and load profile data
    fetch(`${API_BASE_URL}/api/profile/industry/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      console.log('Industry profile status response:', data);
      if (data.status) {
        setProfileStatus(data.status);
        console.log('Setting profileStatus to:', data.status);
        
        // ALWAYS update localStorage with fresh status from API (JWT token may be stale)
        userData.status = data.status;
        localStorage.setItem("user", JSON.stringify(userData));
        
        // Load profile data if it exists
        if (data.profile) {
          setProfile({
            companyName: data.profile.company_name || "",
            industryType: data.profile.sector || "",
            businessRole: data.profile.business_role || "",
            location: data.profile.location || "",
            phone: data.profile.phone || "",
            email: userData.email || "",
            website: data.profile.website || "",
            description: data.profile.description || "",
            licenseNumber: "",
            logoPreview: data.profile.profile_picture
              ? imageUrl(data.profile.profile_picture)
              : null,
            latitude: data.profile.latitude || null,
            longitude: data.profile.longitude || null,
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

  // Fetch dashboard data when dashboard section is active
  useEffect(() => {
    if (activeSection === "dashboard" && profileStatus === "approved") {
      setDashLoading(true);
      const token = localStorage.getItem("token");
      Promise.all([
        fetch(`${API_BASE_URL}/api/industry/dashboard-summary`, { headers: { Authorization: `Bearer ${token}` } })
          .then(async r => {
            if (r.status === 403) {
              const error = await r.json();
              console.error('Dashboard summary 403:', error);
              // Don't auto-logout - let user manually refresh
              // Auto-logout will be enabled once backend is deployed with JWT fix
              throw new Error(error.message || 'Access denied');
            }
            return r.json();
          }),
        fetch(`${API_BASE_URL}/api/industry/recent-requests`, { headers: { Authorization: `Bearer ${token}` } })
          .then(async r => {
            if (r.status === 403) {
              const error = await r.json();
              console.error('Recent requests 403:', error);
              // Don't auto-logout - let user manually refresh
              throw new Error(error.message || 'Access denied');
            }
            return r.json();
          }),
        fetch(`${API_BASE_URL}/api/industry/products-summary`, { headers: { Authorization: `Bearer ${token}` } })
          .then(async r => {
            if (r.status === 403) {
              const error = await r.json();
              console.error('Products summary 403:', error);
              // Don't auto-logout - let user manually refresh
              throw new Error(error.message || 'Access denied');
            }
            return r.json();
          }),
      ]).then(([summary, reqs, prods]) => {
        setDashSummary(summary);
        setDashRequests(Array.isArray(reqs) ? reqs : []);
        setDashProducts(Array.isArray(prods) ? prods : []);
      }).catch(err => {
        console.error('Dashboard data fetch error:', err);
        // Don't show alert if we already showed one above
        if (!err.message.includes('Access denied')) {
          console.error('Failed to load dashboard data:', err);
        }
      }).finally(() => setDashLoading(false));
    }
  }, [activeSection, profileStatus]);

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



  // Notification functions
  const fetchNotifications = async () => {
    setNotifsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/industry/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setNotifsLoading(false);
    }
  };

  const fetchNotifUnreadCount = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/industry/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifUnreadCount(data.count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notification unread count:", err);
    }
  };

  const markNotificationRead = async (notifId) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE_URL}/api/industry/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
      setNotifUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE_URL}/api/industry/notifications/mark-all-read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setNotifUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    if (diffHour > 0) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    return "Just now";
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markNotificationRead(notification.id);
    }
    setShowNotifDropdown(false);
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
  };

  // Fetch notifications when profile is approved
  useEffect(() => {
    if (profileStatus === "approved") {
      fetchNotifications();
      fetchNotifUnreadCount();
    }
  }, [profileStatus]);

  // Poll for new notifications every 15 seconds
  useEffect(() => {
    if (profileStatus !== "approved") return;
    const interval = setInterval(() => {
      fetchNotifUnreadCount();
    }, 15000);
    return () => clearInterval(interval);
  }, [profileStatus]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const container = document.getElementById('notification-bell-container');
      if (container && !container.contains(event.target)) {
        setShowNotifDropdown(false);
      }
    };
    if (showNotifDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifDropdown]);

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !selectedConversation) return;

    const token = localStorage.getItem("token");
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const messageText = newMessage;
    const file = selectedFile;
    
    // Optimistically add message to UI
    const tempMsg = {
      id: Date.now(),
      content: messageText || (file ? `📎 ${file.name}` : ''),
      sender_id: userData.id,
      sender_role: 'industry',
      created_at: new Date().toISOString(),
      file_name: file ? file.name : null,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      // Create FormData for file upload
      const formData = new FormData();
      if (messageText) formData.append('content', messageText);
      if (file) formData.append('file', file);

      // Save to database
      const response = await fetch(`${API_BASE_URL}/api/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const savedMessage = await response.json();

      // Send via Socket.IO (text only, file info will be fetched)
      if (socket && socket.connected) {
        socket.emit('send_message', {
          conversationId: selectedConversation.id,
          senderId: userData.id,
          receiverId: selectedConversation.stakeholder_user_id,
          message: messageText || `📎 ${file?.name || 'File attachment'}`,
          hasFile: !!file
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      const res = await fetch(`${API_BASE_URL}/api/conversations/create`, {
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
      
      await res.json(); // get conversation
      
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

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile(prev => ({ ...prev, logoPreview: reader.result }));
    };
    reader.readAsDataURL(file);

    // Upload to server so it persists across sessions
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("profile_picture", file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me/picture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      // Replace the base64 preview with the persisted server URL
      setProfile(prev => ({
        ...prev,
        logoPreview: imageUrl(data.profile_picture),
      }));
    } catch (err) {
      console.error("Logo upload failed:", err.message);
      // Preview stays visible but warn the user
      alert("Logo preview shown but upload failed: " + err.message);
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
          business_role: profile.businessRole || null,
          location: profile.location,
          description: profile.description,
          phone: profile.phone,
          website: profile.website,
          established_year: null,
          latitude: profile.latitude || null,
          longitude: profile.longitude || null
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
        
        // Refresh page to show updated status
        window.location.reload();
      } else {
        // Refresh page to show updated profile
        window.location.reload();
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

  // ── GPS location detection ──
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus("denied");
      return;
    }
    setGpsLoading(true);
    setGpsStatus("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProfile(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        setGpsLoading(false);
        setGpsStatus("detected");
      },
      () => {
        setGpsLoading(false);
        setGpsStatus("denied");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const canAccessOtherSections = profileStatus === "approved";
  const showPendingBanner = profileStatus === "pending";

  // ── Product CRUD Handlers ──
  const handleProductFormChange = (e) => {
    const { name, value } = e.target;
    setProductForm(prev => ({ ...prev, [name]: value }));

    // Inline duplicate check on name field
    if (name === "name") {
      const normalized = value.trim().toLowerCase();
      if (normalized) {
        const duplicate = products.find(
          p => p.name.trim().toLowerCase() === normalized && p.id !== editingProduct?.id
        );
        setProductNameError(duplicate ? `"${duplicate.name}" already exists.` : "");
      } else {
        setProductNameError("");
      }
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (productNameError) return;

    const token = localStorage.getItem("token");
    const url = editingProduct
      ? `${API_BASE_URL}/api/products/${editingProduct.id}`
      : `${API_BASE_URL}/api/products`;
    const method = editingProduct ? "PUT" : "POST";

    try {
      // Always use FormData so we can attach the image file
      const formData = new FormData();
      formData.append("name",        productForm.name);
      formData.append("category",    productForm.category);
      formData.append("price",       productForm.price);
      formData.append("unit",        productForm.unit);
      formData.append("description", productForm.description);
      if (productImage) formData.append("image", productImage);

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` }, // NO Content-Type — let browser set multipart boundary
        body: formData,
      });
      
      if (res.status === 402) {
        setShowProductForm(false);
        setShowSubModal(true);
        return;
      }

      if (res.status === 409) {
        const data = await res.json();
        setProductNameError(data.message);
        // If server tells us the existing product id, offer to edit it
        if (data.existing_id) {
          const existing = products.find(p => p.id === data.existing_id);
          if (existing && window.confirm(`${data.message}\n\nDo you want to edit the existing product instead?`)) {
            setProductNameError("");
            handleEditProduct(existing);
          }
        }
        return;
      }
      
      if (res.status === 403) {
        // Don't auto-logout - show error message instead
        alert("Your account needs to be approved by admin. If you were recently approved, please refresh the page.");
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
      setProductNameError("");
      setProductForm({ name: "", description: "", price: "", unit: "unit", category: "", discount_percentage: "" });
      setProductImage(null);
      setProductImagePreview(null);
      if (productImageRef.current) productImageRef.current.value = "";
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
      category: product.category || "",
      discount_percentage: product.discount_percentage || ""
    });
    setProductImage(null);
    setProductImagePreview(product.image_url ? imageUrl(product.image_url) : null);
    if (productImageRef.current) productImageRef.current.value = "";
    setProductNameError("");
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
          <Link to="/" className="nav-home-btn" title="Back to Home">
            <FaHome />
          </Link>
          <Link to="/help" className="help-link" title="Help Center">
            <FaQuestionCircle /> Help
          </Link>
          
          {/* Notification Bell */}
          {profileStatus === "approved" && (
            <div id="notification-bell-container" style={{ position: 'relative' }}>
              <button 
                className="notification-bell" 
                onClick={() => {
                  setShowNotifDropdown(!showNotifDropdown);
                  if (!showNotifDropdown) fetchNotifications();
                }}
                title="Notifications"
              >
                <FaBell />
                {notifUnreadCount > 0 && (
                  <span className="notification-badge">{notifUnreadCount}</span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <h4>Notifications</h4>
                    {notifUnreadCount > 0 && (
                      <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="notification-list">
                    {notifsLoading ? (
                      <div className="notif-loading">Loading...</div>
                    ) : notifications.length === 0 ? (
                      <div className="no-notifications">No notifications yet</div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          className={`notification-item ${notif.is_read ? 'read' : 'unread'}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className="notif-title">{notif.title}</div>
                          <div className="notif-message">{notif.message}</div>
                          <div className="notif-time">{formatTimeAgo(notif.created_at)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <span className="welcome-text">Welcome back</span>
          <div className="user-avatar"><FaIndustry /></div>
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
            <p>{profile.businessRole ? `${profile.businessRole} · ` : ""}{profile.industryType || "Industry"}</p>
          </div>
        </div>

        <div className="sidebar-header">
          <h3>Menu</h3>
          <button className="close-btn" onClick={() => setIsMenuOpen(false)}><FaTimes /></button>
        </div>

        <ul className="menu-list">
          {menuItems.map(item => (
            <li
              key={item.id}
              className={`menu-item ${activeSection === item.id ? "active" : ""} ${!canAccessOtherSections && item.id !== "profile" && item.id !== "dashboard" ? "menu-item-locked" : ""}`}
              onClick={() => {
                if (!canAccessOtherSections && item.id !== "profile" && item.id !== "dashboard") return;
                setActiveSection(item.id);
                setIsMenuOpen(false);
              }}
            >
              <span className="menu-icon">{item.icon}</span>
              <span>{item.label}</span>
              {!canAccessOtherSections && item.id !== "profile" && item.id !== "dashboard" && (
                <span className="menu-lock"><FaLock /></span>
              )}
            </li>
          ))}
        </ul>

        <div className="sidebar-footer">
          <Link to="/" className="logout-btn">Logout</Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="main-content">
        {/* Per-section header — hidden for dashboard which has its own hero */}
        {activeSection !== "dashboard" && (
          <div className="content-header">
            <h1>{menuItems.find(item => item.id === activeSection)?.label || "Dashboard"}</h1>
            <p>
              {activeSection === "requests"  ? "All purchase requests from stakeholders for your products" :
               activeSection === "products"  ? "Manage and update your product catalog" :
               activeSection === "profile"   ? "Update your company information and profile" :
               activeSection === "messages"  ? "Communicate directly with your stakeholders" :
               activeSection === "analytics" ? "Track your business performance and insights" :
               "Manage your business profile and operations"}
            </p>
          </div>
        )}

        {/* ── DASHBOARD SECTION ── */}
        {activeSection === "dashboard" && (
          <div className="dash-page">
            {/* Welcome hero */}
            <div className="dash-hero">
              <div className="dash-hero-text">
                <h1>Welcome back, {profile.companyName || "Industry"} 👋</h1>
                <p>{profile.industryType}{profile.location ? ` · ${profile.location}` : ""}</p>
              </div>
              <div className="dash-hero-actions">
                <button className="dash-hero-btn primary" onClick={() => { setActiveSection("products"); setShowProductForm(true); setEditingProduct(null); setProductNameError(""); setProductForm({ name: "", description: "", price: "", unit: "unit", category: "" }); }}>
                  + Add Product
                </button>
                <button className="dash-hero-btn secondary" onClick={() => setActiveSection("requests")}>
                  View Requests
                </button>
              </div>
            </div>

            {!canAccessOtherSections ? (
              <div className="dash-pending-notice">
                <span><FaClock /></span>
                <div>
                  <strong>Profile under review</strong>
                  <p>Analytics and requests will appear here once your account is approved.</p>
                </div>
                <button className="dash-hero-btn secondary" onClick={() => setActiveSection("profile")}>
                  Complete Profile →
                </button>
              </div>
            ) : dashLoading ? (
              <div className="dash-loading">
                <div className="dash-spinner"></div>
                <p>Loading dashboard...</p>
              </div>
            ) : (
              <>
                {/* Stats row */}
                <div className="dash-stats">
                  {[
                    { icon: <FaBox />, label: "Products",          value: dashSummary?.total_products     ?? 0, color: "#667eea" },
                    { icon: <FaClipboardList />, label: "Total Requests",    value: dashSummary?.total_requests     ?? 0, color: "#0a5c2f" },
                    { icon: <FaClock />, label: "Pending",           value: dashSummary?.pending_requests   ?? 0, color: "#f59e0b" },
                    { icon: <FaCheckCircle />, label: "Approved",          value: dashSummary?.approved_requests  ?? 0, color: "#10b981" },
                    { icon: <FaHandshake />, label: "Stakeholders",      value: dashSummary?.total_stakeholders ?? 0, color: "#764ba2" },
                  ].map(s => (
                    <div key={s.label} className="dash-stat-card" style={{ "--stat-color": s.color }}>
                      <div className="dash-stat-icon">{s.icon}</div>
                      <div className="dash-stat-value">{s.value}</div>
                      <div className="dash-stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="dash-grid">
                  {/* Recent Requests */}
                  <div className="dash-card">
                    <div className="dash-card-header">
                      <h3>📩 Recent Requests</h3>
                      <button className="dash-card-link" onClick={() => setActiveSection("requests")}>View all →</button>
                    </div>
                    {dashRequests.length === 0 ? (
                      <div className="dash-empty">No requests yet</div>
                    ) : (
                      <div className="dash-req-list">
                        {dashRequests.map(req => (
                          <div key={req.id} className="dash-req-row">
                            <div className="dash-req-avatar">{req.full_name?.charAt(0) || "?"}</div>
                            <div className="dash-req-info">
                              <div className="dash-req-name">
                                {req.full_name}
                                {req.identity_verified && <span className="dash-verified-badge">🛡️</span>}
                              </div>
                              <div className="dash-req-product">📦 {req.product_name} · qty {req.quantity}</div>
                              {req.notes && <div className="dash-req-notes">{req.notes.slice(0, 60)}{req.notes.length > 60 ? "…" : ""}</div>}
                            </div>
                            <span className={`dash-req-status dash-status-${req.status}`}>
                              {req.status === "approved" ? "✓" : req.status === "rejected" ? "✕" : "⏳"}
                              {" "}{req.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Products */}
                  <div className="dash-card">
                    <div className="dash-card-header">
                      <h3>📦 Products</h3>
                      <button className="dash-card-link" onClick={() => setActiveSection("products")}>Manage →</button>
                    </div>
                    {dashProducts.length === 0 ? (
                      <div className="dash-empty">
                        <p>No products yet</p>
                        <button className="dash-hero-btn primary" style={{marginTop:"10px"}} onClick={() => { setActiveSection("products"); setShowProductForm(true); }}>
                          + Add First Product
                        </button>
                      </div>
                    ) : (
                      <div className="dash-prod-list">
                        {dashProducts.map(p => (
                          <div key={p.id} className="dash-prod-row">
                            <div className="dash-prod-icon">📦</div>
                            <div className="dash-prod-info">
                              <div className="dash-prod-name">{p.name}</div>
                              {p.category && <div className="dash-prod-cat">{p.category}</div>}
                            </div>
                            <div className="dash-prod-price">
                              {p.price ? `${Number(p.price).toLocaleString()} ETB` : "—"}
                            </div>
                            <span className={`dash-prod-status ${p.is_available ? "available" : "unavailable"}`}>
                              {p.is_available ? "Active" : "Hidden"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="dash-quick-actions">
                  <h3>⚡ Quick Actions</h3>
                  <div className="dash-qa-grid">
                    {[
                      { icon: <FaPlus />, label: "Add Product",     action: () => { setActiveSection("products"); setShowProductForm(true); setEditingProduct(null); setProductNameError(""); setProductForm({ name: "", description: "", price: "", unit: "unit", category: "" }); } },
                      { icon: <FaClipboardList />, label: "View Requests",   action: () => setActiveSection("requests") },
                      { icon: <FaComments />, label: "Messages",        action: () => setActiveSection("messages") },
                      { icon: <FaUser />, label: "Manage Profile",  action: () => setActiveSection("profile") },
                      { icon: <FaChartBar />, label: "Analytics",       action: () => setActiveSection("analytics") },
                      ...(!subStatus?.is_subscribed ? [{ icon: <FaStar />, label: "Upgrade Premium", action: () => setShowSubModal(true) }] : []),
                    ].map(qa => (
                      <button key={qa.label} className="dash-qa-btn" onClick={qa.action}>
                        <span className="dash-qa-icon">{qa.icon}</span>
                        <span>{qa.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Pending Approval Banner */}
        {activeSection === "profile" && profileStatus === "pending" && (
          <div className="pending-banner">
            <div className="banner-icon"><FaClock /></div>
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

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="industryType">Industry Type *</label>
                      <select id="industryType" name="industryType" value={profile.industryType} onChange={handleProfileChange} required>
                        <option value="">Select type</option>
                        <option>Cement Manufacturer</option>
                        <option>Steel &amp; Metal Producer</option>
                        <option>Construction Materials Supplier</option>
                        <option>Electrical &amp; Lighting</option>
                        <option>Plumbing &amp; Sanitary</option>
                        <option>Machinery &amp; Equipment</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="businessRole">Business Role *</label>
                      <select id="businessRole" name="businessRole" value={profile.businessRole} onChange={handleProfileChange} required>
                        <option value="">Select role</option>
                        <option value="Supplier">Supplier</option>
                        <option value="Manufacturer">Manufacturer</option>
                        <option value="Producer">Producer</option>
                        <option value="Distributor">Distributor</option>
                        <option value="Contractor">Contractor</option>
                      </select>
                    </div>
                  </div>

                  {/* Location with GPS */}
                  <div className="form-group">
                    <label htmlFor="location">Location / City *</label>
                    <input
                      type="text"
                      id="location"
                      name="location"
                      value={profile.location}
                      onChange={handleProfileChange}
                      placeholder="e.g. Addis Ababa, Bole"
                      required
                    />
                  </div>

                  {/* GPS coordinates — auto-detected, not manually entered */}
                  <div className="form-group">
                    <label>GPS Coordinates <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.85rem" }}>(for map display)</span></label>
                    <div className="gps-row">
                      <button type="button" className="gps-btn" onClick={detectLocation} disabled={gpsLoading}>
                        {gpsLoading ? "⏳ Detecting..." : "📍 Use My Location"}
                      </button>
                      {gpsStatus === "detected" && profile.latitude && (
                        <span className="gps-ok">
                          ✅ {Number(profile.latitude).toFixed(4)}, {Number(profile.longitude).toFixed(4)}
                        </span>
                      )}
                      {gpsStatus === "denied" && (
                        <span className="gps-denied">⚠️ Location access denied — map pin won't be shown</span>
                      )}
                      {!gpsStatus && profile.latitude && (
                        <span className="gps-ok">
                          📍 {Number(profile.latitude).toFixed(4)}, {Number(profile.longitude).toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="latitude">Latitude (for map)</label>
                      <input
                        type="number"
                        id="latitude"
                        name="latitude"
                        value={profile.latitude}
                        onChange={handleProfileChange}
                        placeholder="e.g. 9.0320"
                        step="0.000001"
                        min="-90"
                        max="90"
                      />
                      <small style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>
                        Optional: Your location's latitude
                      </small>
                    </div>
                    <div className="form-group">
                      <label htmlFor="longitude">Longitude (for map)</label>
                      <input
                        type="number"
                        id="longitude"
                        name="longitude"
                        value={profile.longitude}
                        onChange={handleProfileChange}
                        placeholder="e.g. 38.7469"
                        step="0.000001"
                        min="-180"
                        max="180"
                      />
                      <small style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>
                        Optional: Your location's longitude
                      </small>
                    </div>
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
                    <p className="industry-type">{profile.industryType || "Industry Type"}{profile.businessRole ? ` · ${profile.businessRole}` : ""}</p>
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
              <div>
                <h2>Manage Product Listings</h2>
                {subStatus && !subStatus.is_subscribed && (
                  <p className="product-limit-info">
                    {products.length}/{FREE_PRODUCT_LIMIT} products used on free plan
                    {products.length >= FREE_PRODUCT_LIMIT && (
                      <button className="inline-upgrade-btn" onClick={() => setShowSubModal(true)}>
                        <FaStar /> Upgrade for unlimited
                      </button>
                    )}
                  </p>
                )}
                {subStatus?.is_subscribed && (
                  <p className="product-limit-info premium-info"><FaStar /> Premium — unlimited listings</p>
                )}
              </div>
              <button 
                className="add-product-btn"
                onClick={() => {
                  if (!subStatus?.is_subscribed && products.length >= FREE_PRODUCT_LIMIT) {
                    setShowSubModal(true);
                    return;
                  }
                  setShowProductForm(true);
                  setEditingProduct(null);
                  setProductNameError("");
                  setProductForm({ name: "", description: "", price: "", unit: "unit", category: "" });
                }}
              >
                {!subStatus?.is_subscribed && products.length >= FREE_PRODUCT_LIMIT ? <><FaLock /> Upgrade to Add More</> : "+ Add Product"}
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
                  {/* ── Product Image ── */}
                  <div className="form-group">
                    <label>Product Image <span style={{ color: "#9ca3af", fontWeight: 400 }}>(JPG/PNG/WebP, max 2 MB)</span></label>
                    <div className="product-img-upload-wrap">
                      {productImagePreview ? (
                        <div className="product-img-preview-box">
                          <img src={productImagePreview} alt="Preview" className="product-img-preview" />
                          <button
                            type="button"
                            className="product-img-remove"
                            onClick={() => {
                              setProductImage(null);
                              setProductImagePreview(null);
                              if (productImageRef.current) productImageRef.current.value = "";
                            }}
                          >✕ Remove</button>
                        </div>
                      ) : (
                        <label className="product-img-placeholder" htmlFor="product-image-input">
                          <span className="product-img-icon">📷</span>
                          <span>Click to upload image</span>
                          <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Optional</span>
                        </label>
                      )}
                      <input
                        id="product-image-input"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        ref={productImageRef}
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            alert("Image must be smaller than 2 MB");
                            e.target.value = "";
                            return;
                          }
                          setProductImage(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setProductImagePreview(reader.result);
                          reader.readAsDataURL(file);
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Product Name *</label>
                      <input
                        type="text"
                        name="name"
                        value={productForm.name}
                        onChange={handleProductFormChange}
                        required
                        style={productNameError ? { borderColor: "#e53e3e" } : {}}
                      />
                      {productNameError && (
                        <div className="product-name-error">
                          <span>⚠️ {productNameError}</span>
                          {products.find(p => p.name.trim().toLowerCase() === productForm.name.trim().toLowerCase() && p.id !== editingProduct?.id) && (
                            <button
                              type="button"
                              className="edit-existing-btn"
                              onClick={() => {
                                const existing = products.find(p => p.name.trim().toLowerCase() === productForm.name.trim().toLowerCase() && p.id !== editingProduct?.id);
                                if (existing) handleEditProduct(existing);
                              }}
                            >
                              Edit existing →
                            </button>
                          )}
                        </div>
                      )}
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

                  {/* Discount */}
                  <div className="form-group">
                    <label>Discount % <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: "0.82rem" }}>Optional (0–100)</span></label>
                    <input
                      type="number"
                      name="discount_percentage"
                      value={productForm.discount_percentage}
                      onChange={handleProductFormChange}
                      min="0"
                      max="100"
                      step="1"
                      placeholder="e.g. 20 for 20% off"
                    />
                    {productForm.discount_percentage > 0 && productForm.price > 0 && (
                      <small className="discount-preview">
                        Original: {Number(productForm.price).toLocaleString()} ETB →{" "}
                        <strong style={{ color: "#dc2626" }}>
                          {(productForm.price * (1 - productForm.discount_percentage / 100)).toFixed(2)} ETB
                        </strong>{" "}
                        after {productForm.discount_percentage}% off
                      </small>
                    )}
                  </div>
                  <div className="form-actions">
                    <button type="button" className="cancel-btn" onClick={() => {
                      setShowProductForm(false);
                      setProductImage(null);
                      setProductImagePreview(null);
                    }}>
                      Cancel
                    </button>
                    <button type="submit" className="save-btn" disabled={!!productNameError}>
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
                    {/* Product image */}
                    <div className="product-item-img-wrap">
                      {product.image_url ? (
                        <img
                          src={imageUrl(product.image_url)}
                          alt={product.name}
                          className="product-item-img"
                          onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                        />
                      ) : null}
                      <div className="product-item-img-placeholder" style={{ display: product.image_url ? "none" : "flex" }}>
                        📦
                      </div>
                    </div>
                    <div className="product-item-body">
                      <div className="product-item-badges">
                        {product.is_new && <span className="badge-new">🆕 New</span>}
                        {product.is_popular && <span className="badge-popular">🔥 Popular</span>}
                        {product.discount_percentage > 0 && (
                          <span className="badge-discount">-{product.discount_percentage}% OFF</span>
                        )}
                      </div>
                      <h4>{product.name}</h4>
                      <p className="product-category">{product.category}</p>
                      {product.description && <p className="product-desc">{product.description}</p>}
                      <div className="product-price">
                        {product.discount_percentage > 0 ? (
                          <>
                            <span className="price-original">{Number(product.price).toLocaleString()} ETB</span>
                            <span className="price-discounted">{Number(product.discounted_price).toLocaleString()} ETB</span>
                            <span className="price-unit">/ {product.unit}</span>
                          </>
                        ) : (
                          product.price ? `${Number(product.price).toLocaleString()} ETB / ${product.unit}` : "Price on request"
                        )}
                      </div>
                      <div className="product-actions">
                        <button onClick={() => handleEditProduct(product)}>Edit</button>
                        <button className="delete-btn" onClick={() => handleDeleteProduct(product.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Purchase Requests / Transaction History Section */}
        {canAccessOtherSections && activeSection === "requests" && (
          <div className="requests-section">
            <TransactionHistory role="industry" onMessage={(stakeholderId) => openConversationWithStakeholder(stakeholderId)} />
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
                              <div className="message-content">
                                {msg.content}
                                {msg.file_url && (
                                  <div className="message-attachment">
                                    <a href={`${API_BASE_URL}${msg.file_url}`} target="_blank" rel="noopener noreferrer" className="attachment-link">
                                      📎 {msg.file_name || 'Download attachment'}
                                    </a>
                                  </div>
                                )}
                              </div>
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
                      {selectedFile && (
                        <div className="selected-file-preview">
                          <span>📎 {selectedFile.name}</span>
                          <button type="button" onClick={removeSelectedFile} className="remove-file-btn">✕</button>
                        </div>
                      )}
                      <div className="input-row">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          style={{ display: 'none' }}
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                        />
                        <button 
                          type="button" 
                          onClick={() => fileInputRef.current?.click()} 
                          className="attach-btn"
                          title="Attach file"
                        >
                          📎
                        </button>
                        <input
                          type="text"
                          placeholder="Type your message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        />
                        <button onClick={sendMessage} disabled={!newMessage.trim() && !selectedFile}>
                          Send
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Analytics Section */}
        {canAccessOtherSections && activeSection === "analytics" && (
          <AnalyticsSection subStatus={subStatus} onUpgrade={() => setShowSubModal(true)} />
        )}

      </main>

      {showSubModal && (
        <SubscriptionModal
          onClose={() => setShowSubModal(false)}
          reason={
            activeSection === "products"
              ? `Free plan allows up to ${FREE_PRODUCT_LIMIT} products. Upgrade for unlimited listings, analytics, and more.`
              : undefined
          }
          onSuccess={() => {
            setShowSubModal(false);
            const token = localStorage.getItem("token");
            fetch(`${API_BASE_URL}/api/subscription/status`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json()).then(setSubStatus);
            alert("🎉 Premium activated! Enjoy unlimited access.");
          }}
        />
      )}
    </div>
  );
}

function AnalyticsSection({ subStatus, onUpgrade }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_BASE_URL}/api/subscription/analytics`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(setAnalytics).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>Loading analytics...</div>;

  const isPremium = subStatus?.is_subscribed;

  return (
    <div style={{ padding: "0 0 40px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 800, color: "#0d1b2a" }}>Analytics</h2>
        <p style={{ margin: 0, color: "#777", fontSize: "0.9rem" }}>
          {isPremium ? "Full analytics — Premium plan" : "Basic analytics — Upgrade for full insights"}
        </p>
      </div>

      {/* Basic stat always visible */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div style={{ background: "white", borderRadius: "16px", padding: "24px", border: "1px solid #f0f0f0", textAlign: "center" }}>
          <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#667eea" }}>{analytics?.total_profile_views || 0}</div>
          <div style={{ fontSize: "0.85rem", color: "#888", marginTop: "6px" }}>Profile Views</div>
        </div>

        {isPremium ? (
          <>
            <div style={{ background: "white", borderRadius: "16px", padding: "24px", border: "1px solid #f0f0f0", textAlign: "center" }}>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#0a5c2f" }}>{analytics?.total_product_clicks || 0}</div>
              <div style={{ fontSize: "0.85rem", color: "#888", marginTop: "6px" }}>Product Clicks</div>
            </div>
            <div style={{ background: "white", borderRadius: "16px", padding: "24px", border: "1px solid #f0f0f0", textAlign: "center" }}>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#f59e0b" }}>{analytics?.total_purchase_requests || 0}</div>
              <div style={{ fontSize: "0.85rem", color: "#888", marginTop: "6px" }}>Purchase Requests</div>
            </div>
          </>
        ) : (
          <>
            {["Product Clicks", "Purchase Requests"].map(label => (
              <div key={label} style={{ background: "#f8f9fc", borderRadius: "16px", padding: "24px", border: "2px dashed #e0e0e0", textAlign: "center", position: "relative" }}>
                <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#ccc", filter: "blur(4px)" }}>42</div>
                <div style={{ fontSize: "0.85rem", color: "#bbb", marginTop: "6px" }}>{label}</div>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "1.2rem" }}>🔒</span>
                  <span style={{ fontSize: "0.75rem", color: "#888", fontWeight: 600 }}>Premium Only</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {!isPremium && (
        <div style={{ background: "linear-gradient(135deg, #667eea15, #764ba215)", border: "2px solid #667eea30", borderRadius: "16px", padding: "28px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "10px" }}>📊</div>
          <h3 style={{ margin: "0 0 8px", color: "#0d1b2a", fontSize: "1.1rem" }}>Unlock Full Analytics</h3>
          <p style={{ margin: "0 0 20px", color: "#777", fontSize: "0.9rem" }}>
            See product clicks, interested stakeholders, and 30-day activity trends with Premium.
          </p>
          <button
            onClick={onUpgrade}
            style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", color: "white", border: "none", padding: "12px 28px", borderRadius: "10px", fontWeight: 700, cursor: "pointer", fontSize: "0.95rem" }}
          >
            ⭐ Upgrade to Premium
          </button>
        </div>
      )}
    </div>
  );
}

export default Industry;

