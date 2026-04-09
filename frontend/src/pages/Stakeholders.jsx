import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import StakeholderNav from "../components/StakeholderNav";
import SubscriptionModal from "../components/SubscriptionModal";
import RecommendWidget from "../components/RecommendWidget";
import "./Stakeholders.css";
import "./StakeholdersDarkMode.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
let socket;

function Stakeholders() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  const [subStatus, setSubStatus] = useState(null);

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
        setIndustries(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchIndustries();
  }, [navigate]);

  const filteredIndustries = industries.filter((industry) =>
    (industry.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    industry.sector?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (locationFilter === "" || industry.location?.toLowerCase().includes(locationFilter.toLowerCase()))
  );

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

  return (
    <div className="modern-stakeholder-page">
      <StakeholderNav />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Find the perfect <span className="text-green">industrial partner</span> for your next venture.
            </h1>
            <p className="hero-subtitle">
              Access a curated network of verified manufacturers, suppliers, and contractors across Ethiopia's 11 regions.
            </p>

            {/* Search Bar */}
            <div className="search-container">
              <div className="search-input-group">
                <span className="material-icon">search</span>
                <input
                  type="text"
                  placeholder="Search by company name or service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-field"
                />
              </div>
              <div className="search-input-group">
                <span className="material-icon">location_on</span>
                <input
                  type="text"
                  placeholder="Location (City, Region)"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="search-field"
                />
              </div>
              <button className="search-btn">Search</button>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="filter-bar">
        <div className="filter-content">
          <div className="filter-group">
            <label className="filter-label">SECTOR</label>
            <select className="filter-select">
              <option>All Categories</option>
              <option>Manufacturing</option>
              <option>Construction</option>
              <option>Logistics</option>
            </select>
          </div>
          <div className="filter-result">
            <span>Showing {filteredIndustries.length} verified partners</span>
          </div>
        </div>
      </section>

      {/* Recommendation Widget */}
      <div className="widget-container">
        <RecommendWidget mode="products" />
      </div>

      {/* Company Cards Grid */}
      <section className="cards-section">
        {loading ? (
          <div className="loading-state">Loading industries...</div>
        ) : error ? (
          <div className="error-state">Error: {error}</div>
        ) : filteredIndustries.length === 0 ? (
          <div className="empty-state">No industries found.</div>
        ) : (
          <div className="cards-grid">
            {filteredIndustries.map((industry) => (
              <div key={industry.id} className="company-card">
                <div className="card-top">
                  <div className="company-logo">
                    {industry.company_name?.charAt(0) || "?"}
                  </div>
                  <span className="badge-verified">Verified</span>
                </div>
                
                <div className="card-body">
                  <h3 className="company-name">{industry.company_name}</h3>
                  <div className="company-meta">
                    <span className="material-icon">factory</span>
                    <span>{industry.sector}</span>
                    <span className="dot">•</span>
                    <span className="material-icon">location_on</span>
                    <span>{industry.location}</span>
                  </div>
                  <p className="company-desc">
                    {industry.description || "Leading industrial partner providing quality products and services."}
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
        )}
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
                    <span>📎 {msg.fileName}</span>
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
    </div>
  );
}

export default Stakeholders;
