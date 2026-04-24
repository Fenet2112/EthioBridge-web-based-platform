import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import StakeholderNav from "../components/StakeholderNav";
import "./StakeholderMessages.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
let socket;

function StakeholderMessages() {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [activeTab, setActiveTab] = useState("conversations"); // "conversations" | "support"
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  // Support thread state
  const [supportThread, setSupportThread] = useState([]);
  const [supportUnread, setSupportUnread] = useState(0);
  const [supportLoading, setSupportLoading] = useState(false);
  const supportEndRef = useRef(null);

  // Check authentication and approval status
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    
    if (!token) {
      navigate("/login");
      return;
    }

    if (userData.status !== "approved") {
      alert("Your account must be approved by admin to access messaging.");
      navigate("/stakeholders");
      return;
    }

    setLoading(false);
    loadConversations();
    loadSupportThread();
  }, [navigate]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Auto-scroll support thread
  useEffect(() => {
    if (supportEndRef.current) {
      supportEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [supportThread]);

  // Socket.IO setup for real-time messaging
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    
    if (userData.id && userData.status === "approved") {
      socket = io(API_BASE_URL);
      
      socket.on('connect', () => {
        console.log('Stakeholder socket connected:', socket.id);
        socket.emit('join', userData.id);
      });

      socket.on('receive_message', (data) => {
        console.log('Stakeholder received message:', data);
        
        // Add message to current conversation if it's open
        if (selectedConversation && data.conversationId === selectedConversation.id) {
          const newMsg = {
            id: Date.now(),
            content: data.message,
            sender_id: data.senderId,
            sender_role: 'industry',
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
  }, [selectedConversation]);

  const loadConversations = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setConversations(data);
      const total = data.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
      setUnreadCount(total);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  };

  const loadSupportThread = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setSupportLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/contact/my-support`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSupportThread(data.thread || []);
        setSupportUnread(data.unread_replies || 0);
      }
    } catch (error) {
      console.error("Failed to load support thread:", error);
    } finally {
      setSupportLoading(false);
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
      sender_role: 'stakeholder',
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
          receiverId: selectedConversation.industry_user_id,
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

  if (loading) {
    return <div className="messages-page-loading">Loading...</div>;
  }

  return (
    <div className="stakeholder-messages-page">
      <StakeholderNav unreadCount={unreadCount + supportUnread} />

      <div className="messages-container">
        {/* Sidebar */}
        <div className="conversations-list">
          {/* Tabs */}
          <div className="messages-tabs">
            <button
              className={`messages-tab ${activeTab === "conversations" ? "active" : ""}`}
              onClick={() => setActiveTab("conversations")}
            >
              Conversations
              {unreadCount > 0 && <span className="tab-badge">{unreadCount}</span>}
            </button>
            <button
              className={`messages-tab ${activeTab === "support" ? "active" : ""}`}
              onClick={() => { setActiveTab("support"); loadSupportThread(); }}
            >
              Support
              {supportUnread > 0 && <span className="tab-badge">{supportUnread}</span>}
            </button>
          </div>

          {activeTab === "conversations" && (
            <>
              {conversations.length === 0 ? (
                <p className="no-conversations">
                  No conversations yet. Start messaging industries from the main page!
                </p>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`conversation-item ${selectedConversation?.id === conv.id ? "active" : ""}`}
                    onClick={() => loadMessages(conv)}
                  >
                    <div className="conv-avatar">{conv.company_name?.charAt(0) || "I"}</div>
                    <div className="conv-info">
                      <h4>{conv.company_name}</h4>
                      <p className="last-message">{conv.last_message || "No messages yet"}</p>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="unread-count">{conv.unread_count}</span>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === "support" && (
            <div className="support-sidebar-info">
              <div className="conv-avatar support-avatar">🛡</div>
              <div className="conv-info">
                <h4>EthioBridge Support</h4>
                <p className="last-message">Your support tickets & replies</p>
              </div>
              {supportUnread > 0 && (
                <span className="unread-count">{supportUnread}</span>
              )}
            </div>
          )}
        </div>

        {/* Main Area */}
        <div className="messages-area">
          {activeTab === "conversations" && (
            <>
              {!selectedConversation ? (
                <div className="no-conversation-selected">
                  <p>Select a conversation to start messaging</p>
                </div>
              ) : (
                <>
                  <div className="messages-header">
                    <div className="industry-info">
                      <div className="industry-avatar">{selectedConversation.company_name?.charAt(0) || "I"}</div>
                      <div>
                        <h3>{selectedConversation.company_name}</h3>
                        <p>{selectedConversation.sector}</p>
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
                            className={`message-bubble ${msg.sender_role === "stakeholder" ? "sent" : "received"}`}
                          >
                            <div className="message-content">
                              {msg.content}
                              {msg.file_url && (
                                <div className="message-attachment">
                                  <a href={`${API_BASE_URL}${msg.file_url}`} target="_blank" rel="noopener noreferrer" className="attachment-link">
                                    📎 {msg.file_name || "Download attachment"}
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="message-time">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                        style={{ display: "none" }}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                      />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="attach-btn" title="Attach file">📎</button>
                      <input
                        type="text"
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                      />
                      <button onClick={sendMessage} disabled={!newMessage.trim() && !selectedFile}>Send</button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === "support" && (
            <>
              <div className="messages-header">
                <div className="industry-info">
                  <div className="industry-avatar support-avatar-header">🛡</div>
                  <div>
                    <h3>EthioBridge Support</h3>
                    <p>Your support tickets and admin replies</p>
                  </div>
                </div>
              </div>

              <div className="messages-list">
                {supportLoading ? (
                  <p style={{ padding: "20px", textAlign: "center" }}>Loading support messages...</p>
                ) : supportThread.length === 0 ? (
                  <div className="no-messages" style={{ padding: "40px 20px", textAlign: "center" }}>
                    <p>No support messages yet.</p>
                    <p style={{ fontSize: "0.9rem", color: "#888", marginTop: "8px" }}>
                      Use the Contact Us or Help Center page to send a message to support.
                    </p>
                  </div>
                ) : (
                  <>
                    {supportThread.map(msg => (
                      <div
                        key={msg.id}
                        className={`message-bubble ${msg.sender === "user" ? "sent" : "received"}`}
                      >
                        {msg.sender === "admin" && (
                          <div className="support-sender-label">🛡 EthioBridge Support</div>
                        )}
                        <div className="message-content">
                          <div className="support-subject">{msg.subject}</div>
                          {msg.content}
                        </div>
                        <div className="message-time">
                          {new Date(msg.created_at).toLocaleString([], {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit"
                          })}
                          {msg.sender === "user" && (
                            <span className={`support-status-pill status-${msg.status}`}>
                              {msg.status_label}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={supportEndRef} />
                  </>
                )}
              </div>

              <div className="support-footer-note">
                <p>To send a new support message, visit the <a href="/contact">Contact Us</a> or <a href="/help">Help Center</a> page.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default StakeholderMessages;
