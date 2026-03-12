import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import ProfileDropdown from "../components/ProfileDropdown";
import "./Stakeholders.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
let socket;

function Stakeholders() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
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

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // ─── Emoji Picker Dynamic Load ───
  const [PickerClass, setPickerClass] = useState(null);

  useEffect(() => {
    import("emoji-mart").then((module) => {
      setPickerClass(() => module.Picker);
    });
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Socket.IO setup
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    
    if (userData.id) {
      socket = io(API_BASE_URL);
      
      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        socket.emit('join', userData.id);
      });

      socket.on('receive_message', (data) => {
        console.log('Message received:', data);
        // Only add message if it's for the current conversation
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

  // Fetch industries from API
  useEffect(() => {
    const fetchIndustries = async () => {
      const token = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        // First, refresh user status
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
        
        // Then fetch industries
        const res = await fetch(`${API_BASE_URL}/api/industries`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
    industry.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    industry.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    industry.location?.toLowerCase().includes(searchTerm.toLowerCase())
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
      // Save message to database
      await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: messageText })
      });

      // Send via Socket.IO for real-time delivery
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
      // Get or create conversation
      const convRes = await fetch(`${API_BASE_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const conversations = await convRes.json();
      
      let conversation = conversations.find(c => c.industry_id === industry.id);
      
      if (conversation) {
        setConversationId(conversation.id);
        
        // Load existing messages
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
        // No conversation yet - will be created on first message
        setConversationId(null);
      }
      
      // Set receiver ID (industry user_id)
      setReceiverId(industry.user_id);
      
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const handleViewDetails = (industryId) => {
    navigate(`/industry/${industryId}`);
  };

  return (
    <div className="stakeholder-page">
      {/* Header */}
      <div className="stakeholder-header">
        <div className="header-content">
          <h1>Connect with Trusted Construction Partners in Ethiopia</h1>
          <p className="subtitle">
            Search verified industries • Compare products, prices & quality • 
            Send direct messages • Request quotes • Build reliable relationships
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="messages-btn"
            onClick={() => navigate("/messages")}
            style={{
              background: 'white',
              color: '#667eea',
              border: '2px solid #667eea',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              marginRight: '10px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#667eea';
              e.target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'white';
              e.target.style.color = '#667eea';
            }}
          >
            <span>💬</span>
            <span>My Messages</span>
          </button>
          <ProfileDropdown />
        </div>
      </div>

      {/* Search */}
      <div className="search-section">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Search by company name, type or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      {/* Industry Cards */}
      <section className="recommendation-section">
        <h2>{searchTerm ? "Search Results" : "Recommended Industries"}</h2>

        {loading ? (
          <p className="no-results">Loading industries...</p>
        ) : error ? (
          <p className="no-results">Error: {error}</p>
        ) : filteredIndustries.length === 0 ? (
          <p className="no-results">No industries found.</p>
        ) : (
          <div className="industries-grid">
            {filteredIndustries.map((industry, index) => (
              <div key={industry.id || index} className="industry-card">
                <div className="card-header">
                  <h3>{industry.company_name}</h3>
                  <span className="rating">★ {industry.rating || "New"}</span>
                </div>
                <p className="industry-type">{industry.sector}</p>
                <p className="location">📍 {industry.location}</p>
                {industry.product_count > 0 && (
                  <p className="product-count">📦 {industry.product_count} products</p>
                )}
                <div className="card-actions">
                  <button 
                    className="view-details-btn"
                    onClick={() => handleViewDetails(industry.id)}
                  >
                    View Details
                  </button>
                  <button 
                    className="contact-btn"
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

      {/* Modern Chat Sidebar */}
      <div className={`chat-sidebar ${menuOpen ? "open" : ""}`}>
        <div className="chat-header">
          <div className="chat-avatar">
            {selectedIndustry?.company_name?.charAt(0) || "?"}
          </div>
          <div className="chat-info">
            <h3>{selectedIndustry?.company_name || "Industry"}</h3>
            <p>{selectedIndustry?.sector || "Construction Partner"}</p>
          </div>
          <button className="close-chat" onClick={() => setMenuOpen(false)}>✕</button>
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
            className="emoji-btn"
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
            className="attach-btn"
            onClick={() => fileInputRef.current.click()}
          >
            📎
          </button>

          {selectedFile && (
            <span className="file-name-preview">
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
            className="send-icon-btn"
            disabled={!currentMessage.trim() && !selectedFile}
          >
            ➤
          </button>

          {showEmojiPicker && PickerClass && (
            <div className="emoji-picker-container">
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
    </div>
  );
}

export default Stakeholders;
