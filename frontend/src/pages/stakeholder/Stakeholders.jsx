import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import StakeholderNav from "../../components/StakeholderNav";
import SubscriptionModal from "../../components/SubscriptionModal";
import RecommendWidget from "../../components/RecommendWidget";
import Logo from "../../components/Logo";
import { getUserLocation, addDistanceToIndustries, sortIndustriesByDistance, formatDistance } from '../../utils/distance';
import { API_BASE_URL } from '../../utils/api';
import "./Stakeholders.css";
import "./StakeholdersDarkMode.css";
let socket;

function Stakeholders() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [selectedSector, setSelectedSector] = useState("All Industries");
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [displayCount, setDisplayCount] = useState(6);

  // Location and distance states
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [sortByDistance, setSortByDistance] = useState(false);

  // Messaging state
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [receiverId, setReceiverId] = useState(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [, setSubStatus] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [PickerClass, setPickerClass] = useState(null);

  useEffect(() => {
    import("emoji-mart").then((module) => {
      setPickerClass(() => module.Picker);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    
    if (userData.id) {
      socket = io(API_BASE_URL);
      
      socket.on('connect', () => {
        socket.emit('join', userData.id);
      });

      socket.on('receive_message', (data) => {
        if (data.conversationId === conversationId) {
          const newMsg = {
            id: Date.now(),
            text: data.message,
            sentBy: "industry",
            time: new Date(data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, newMsg]);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [conversationId]);

  useEffect(() => {
    const fetchIndustries = async () => {
      const token = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const statusRes = await fetch(`${API_BASE_URL}/api/profile/stakeholder/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.status && userData.status !== statusData.status) {
            userData.status = statusData.status;
            localStorage.setItem("user", JSON.stringify(userData));
          }
        }

        const subRes = await fetch(`${API_BASE_URL}/api/subscription/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (subRes.ok) setSubStatus(await subRes.json());
        
        const res = await fetch(`${API_BASE_URL}/api/industries`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch industries");
        
        // Handle both array response and paginated {industries:[]} response
        const list = Array.isArray(data) ? data : (data.industries || []);
        
        // Add distance information if user location is available
        const industriesWithDistance = userLocation 
          ? addDistanceToIndustries(list, userLocation)
          : list;
        
        setIndustries(industriesWithDistance);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchIndustries();
    // Try to get user location on mount
    requestUserLocation();
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Request user's current location
  const requestUserLocation = async () => {
    setLocationLoading(true);
    
    try {
      console.log('[Stakeholders] Requesting user location...');
      const location = await getUserLocation();
      console.log('[Stakeholders] User location obtained:', location);
      setUserLocation(location);
      
      // Update industries with distance information
      if (industries.length > 0) {
        const industriesWithDistance = addDistanceToIndustries(industries, location);
        setIndustries(industriesWithDistance);
      }
    } catch (error) {
      console.error('[Stakeholders] Error getting user location:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  // Update industries with distance when user location changes
  useEffect(() => {
    if (userLocation && industries.length > 0) {
      console.log('[Stakeholders] Updating industries with distance information');
      const industriesWithDistance = addDistanceToIndustries(industries, userLocation);
      setIndustries(industriesWithDistance);
    }
  }, [userLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredIndustries = (() => {
    // Safety check: ensure industries is an array
    if (!Array.isArray(industries)) {
      return [];
    }
    
    let filtered = industries.filter((industry) => {
      const matchesSearch = industry.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        industry.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        industry.location?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesLocation = locationFilter === "" || industry.location?.toLowerCase().includes(locationFilter.toLowerCase());
      
      const matchesSector = selectedSector === "All Industries" || industry.sector?.toLowerCase() === selectedSector.toLowerCase();
      
      return matchesSearch && matchesLocation && matchesSector;
    });

    // Sort by distance if enabled and user location is available
    if (sortByDistance && userLocation) {
      filtered = sortIndustriesByDistance(filtered, userLocation);
    }

    return filtered;
  })();

  const sendMessage = async () => {
    if (!currentMessage.trim() && !selectedFile) return;
    if (!conversationId || !receiverId) {
      alert("Unable to send message. Please try again.");
      return;
    }

    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const token = localStorage.getItem("token");

    const newMsg = {
      id: Date.now(),
      text: currentMessage,
      file: selectedFile ? URL.createObjectURL(selectedFile) : null,
      fileName: selectedFile?.name,
      fileType: selectedFile?.type,
      sentBy: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages([...messages, newMsg]);
    const messageText = currentMessage;
    setCurrentMessage("");
    setSelectedFile(null);

    try {
      const msgRes = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: messageText })
      });

      if (msgRes.status === 402) {
        setMessages(prev => prev.filter(m => m.id !== newMsg.id));
        setCurrentMessage(messageText);
        setShowSubModal(true);
        return;
      }

      if (socket && socket.connected) {
        socket.emit('send_message', {
          conversationId,
          senderId: userData.id,
          receiverId,
          message: messageText
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const openMessageSidebar = async (industry) => {
    setSelectedIndustry(industry);
    setMessages([]);
    setMenuOpen(true);

    const token = localStorage.getItem("token");
    const userData = JSON.parse(localStorage.getItem("user") || "{}");

    try {
      const convRes = await fetch(`${API_BASE_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const conversations = await convRes.json();
      
      let conversation = conversations.find(c => c.industry_id === industry.id);
      
      if (conversation) {
        setConversationId(conversation.id);
        
        const msgRes = await fetch(`${API_BASE_URL}/api/conversations/${conversation.id}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const msgs = await msgRes.json();
        
        const formattedMsgs = msgs.map(msg => ({
          id: msg.id,
          text: msg.content,
          sentBy: msg.sender_id === userData.id ? "user" : "industry",
          time: new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }));
        
        setMessages(formattedMsgs);
      } else {
        setConversationId(null);
      }
      
      setReceiverId(industry.user_id);
      
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const handleViewDetails = (industryId) => {
    navigate(`/industry/${industryId}`);
  };

  const handleShowMore = () => {
    setDisplayCount(prev => prev + 6);
  };

  const displayedIndustries = filteredIndustries.slice(0, displayCount);
  const hasMore = filteredIndustries.length > displayCount;

  return (
    <div className="modern-stakeholder-page">
      <StakeholderNav 
        userLocation={userLocation}
        locationLoading={locationLoading}
        requestUserLocation={requestUserLocation}
      />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Find your perfect <span className="text-green">industrial partner</span> in Ethiopia.
            </h1>
            <p className="hero-subtitle">
              Discover vetted manufacturers, construction firms, and industrial suppliers
              across the Horn of Africa’s fastest-growing economy.
            </p>

            <div className="search-container">
              <div className="search-bar">
                <input
                  type="search"
                  placeholder="Search companies, industries, or locations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-field"
                  aria-label="Search industries"
                />
                <button 
                  className={`search-location-btn ${userLocation ? 'active' : ''} ${locationLoading ? 'loading' : ''}`}
                  onClick={requestUserLocation}
                  disabled={locationLoading}
                  title={userLocation ? 'Location enabled' : 'Get my location'}
                  aria-label="Get current location"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </button>
                <button className="search-btn" aria-label="Search">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="sector-tags">
        {[
          'All Industries',
          'Construction',
          'Manufacturing',
          'Cement & Mining',
          'Textiles',
          'Agro-Processing',
          'Logistics',
        ].map((tag) => (
          <button 
            key={tag} 
            className={`sector-pill ${selectedSector === tag ? 'active' : ''}`}
            onClick={() => setSelectedSector(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <section className="page-body">
        <aside className="sidebar-panel">
          

          <div className="sidebar-card sidebar-widget-card">
            <RecommendWidget mode="products" />
          </div>
        </aside>

        <main className="main-panel">
          <div className="cards-header">
            <div>
              <h2 className="cards-title">Featured Partners</h2>
              <p className="cards-subtitle">
                Browse verified partners handpicked for Ethiopia’s industrial growth.
              </p>
            </div>
            <div className="results-count">Showing {filteredIndustries.length} companies</div>
          </div>

          <section className="cards-section">
            {loading ? (
              <div className="skeleton-grid">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="skeleton-card-top">
                      <div className="skeleton-logo" />
                    </div>
                    <div className="skeleton-card-body">
                      <div className="skeleton-line title" />
                      <div className="skeleton-line meta" />
                      <div className="skeleton-line desc" />
                      <div className="skeleton-line desc-short" />
                    </div>
                    <div className="skeleton-card-actions">
                      <div className="skeleton-button" />
                      <div className="skeleton-button" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="error-state">Error: {error}</div>
            ) : filteredIndustries.length === 0 ? (
              <div className="empty-state">No industries found.</div>
            ) : (
              <>
                <div className="cards-grid">
                  {displayedIndustries.map((industry) => (
                    <div key={industry.id} className="company-card">
                      <div className="card-top">
                        <div className="company-logo">
                          {industry.company_name?.charAt(0) || "?"}
                          <span className="badge-verified" title="Verified"></span>
                        </div>
                        {industry.distance !== null && (
                          <div className="distance-badge">
                            {formatDistance(industry.distance)}
                          </div>
                        )}
                      </div>

                      <div className="card-body">
                        <h3 className="company-name">{industry.company_name}</h3>
                        <div className="company-meta">
                          
                          {industry.sector}
                          <span className="dot">•</span>
                         
                          {industry.location}
                        </div>
                        <p className="company-desc">
                          {industry.description || "Leading provider of industrial products and services."}
                        </p>
                      </div>

                      <div className="card-actions">
                        <button 
                          className="btn-outline"
                          onClick={() => handleViewDetails(industry.id)}
                        >
                          View Details
                        </button>
                        <button 
                          className="btn-primary"
                          onClick={() => openMessageSidebar(industry)}
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {hasMore && (
                  <div className="load-more-container">
                    <button className="load-more-btn" onClick={handleShowMore}>
                      Show more
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      </section>

      {/* Chat Sidebar */}
      <div className={`chat-sidebar ${menuOpen ? "open" : ""}`}>
        <div className="chat-header">
          <div className="chat-avatar">
            {selectedIndustry?.company_name?.charAt(0) || "?"}
          </div>
          <div className="chat-info">
            <h3>{selectedIndustry?.company_name || "Industry"}</h3>
            <p>{selectedIndustry?.sector || "Construction Partner"}</p>
          </div>
          <button className="close-chat" onClick={() => setMenuOpen(false)}>
            <span className="material-icon">close</span>
          </button>
        </div>

        <div className="chat-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-bubble ${msg.sentBy === "user" ? "sent" : "received"}`}
            >
              {msg.file ? (
                msg.fileType.startsWith("image/") ? (
                  <img src={msg.file} alt={msg.fileName} className="chat-image" />
                ) : (
                  <div className="file-attachment">
                    📎 {msg.fileName}
                  </div>
                )
              ) : (
                <p>{msg.text}</p>
              )}
              <span className="message-time">{msg.time}</span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <button
            className="icon-btn"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            😊
          </button>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          <button
            className="icon-btn"
            onClick={() => fileInputRef.current.click()}
          >
            📎
          </button>

          {selectedFile && (
            <span className="file-preview">
              {selectedFile.name.length > 20
                ? selectedFile.name.substring(0, 17) + "..."
                : selectedFile.name}
              <button onClick={() => setSelectedFile(null)}>×</button>
            </span>
          )}

          <textarea
            placeholder="Type a message..."
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows="1"
            className="chat-input"
          />

          <button 
            onClick={sendMessage}
            className="send-btn"
            disabled={!currentMessage.trim() && !selectedFile}
          >
            <span className="material-icon">send</span>
          </button>

          {showEmojiPicker && PickerClass && (
            <div className="emoji-picker-wrapper">
              <PickerClass
                onSelect={(emoji) => {
                  setCurrentMessage((prev) => prev + emoji.native);
                  setShowEmojiPicker(false);
                }}
                set="apple"
                theme="light"
                showPreview={false}
                showSkinTones={false}
                emojiSize={22}
                perLine={9}
              />
            </div>
          )}
        </div>
      </div>

      {showSubModal && (
        <SubscriptionModal
          onClose={() => setShowSubModal(false)}
          reason="You've reached your free messaging limit (3/month). Upgrade for unlimited messages."
          onSuccess={() => {
            setShowSubModal(false);
            const token = localStorage.getItem("token");
            fetch(`${API_BASE_URL}/api/subscription/status`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json()).then(setSubStatus);
            alert("🎉 Premium activated! Enjoy unlimited messaging.");
          }}
        />
      )}

      {/* Footer */}
      {/* Footer */}
      <footer className="stakeholder-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <a href="/" className="footer-logo">
              <Logo size={36} color="#4ade80" />
              <span className="logo-text">EthioBridge</span>
            </a>
            <p>Ethiopia's leading B2B platform connecting construction industries, suppliers, and stakeholders. Building the future of Ethiopian construction, one connection at a time.</p>
            <div className="footer-socials">
              {[
                { icon: "X", label: "Twitter", href: "#" },
                { icon: "in", label: "LinkedIn", href: "#" },
                { icon: "f", label: "Facebook", href: "#" },
                { icon: "YT", label: "YouTube", href: "#" },
              ].map(s => (
                <a key={s.label} href={s.href} className="footer-social-btn" aria-label={s.label}>{s.icon}</a>
              ))}
            </div>
          </div>

          

          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#about">About Us</a></li>
              <li><a href="#services">Services</a></li>
              <li><a href="/help">Help Center</a></li>
              <li><a href="#contact">Contact Us</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Contact</h4>
            <div className="footer-contact-item">
              <span className="material-icon">email</span>
              <a href="mailto:info@ethiobridge.et">info@ethiobridge.et</a>
            </div>
            <div className="footer-contact-item">
              <span className="material-icon">phone</span>
              <a href="tel:+251911123456">+251 911 123 456</a>
            </div>
            <div className="footer-contact-item">
              <span className="material-icon">Location</span>
              <span>Bole, Addis Ababa, Ethiopia</span>
            </div>
            <div className="footer-contact-item">
              <span className="material-icon">schedule</span>
              <span>Mon – Fri, 8AM – 6PM EAT</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2024 EthioBridge. All rights reserved. Building Ethiopia's construction future.</p>
          <div className="footer-bottom-links">
            <a href="#privacy">Privacy Policy</a>
            <span>•</span>
            <a href="#terms">Terms of Service</a>
          </div>
        </div>
      </footer>
         
        </div>
     
    
  );
}

export default Stakeholders;
