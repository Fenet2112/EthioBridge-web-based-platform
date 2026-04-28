import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import StakeholderNav from "../components/StakeholderNav";
import { API_BASE_URL } from "../utils/api";
import "./StakeholderMessages.css";
let socket;

function StakeholderMessages() {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const supportEndRef  = useRef(null);
  const supportPollRef = useRef(null);
  const fileInputRef   = useRef(null);

  const [activeTab, setActiveTab]               = useState("conversations");
  const [conversations, setConversations]       = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages]                 = useState([]);
  const [newMessage, setNewMessage]             = useState("");
  const [selectedFile, setSelectedFile]         = useState(null);
  const [messagesLoading, setMessagesLoading]   = useState(false);
  const [unreadCount, setUnreadCount]           = useState(0);
  const [loading, setLoading]                   = useState(true);

  const [supportThread, setSupportThread]       = useState([]);
  const [supportUnread, setSupportUnread]       = useState(0);
  const [supportLoading, setSupportLoading]     = useState(false);

  // ── Auth check + initial load ──
  useEffect(() => {
    const token    = localStorage.getItem("token");
    const userData = JSON.parse(localStorage.getItem("user") || "{}");

    if (!token) { navigate("/login"); return; }

    if (userData.status !== "approved") {
      alert("Your account must be approved by admin to access messaging.");
      navigate("/stakeholders");
      return;
    }

    setLoading(false);
    loadConversations();
    loadSupportThread();

    // Poll for new admin replies every 15 s
    supportPollRef.current = setInterval(() => loadSupportThread(true), 15000);
    return () => clearInterval(supportPollRef.current);
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll conversations ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Auto-scroll support thread ──
  useEffect(() => {
    supportEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [supportThread]);

  // ── Socket.IO ──
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    if (!userData.id || userData.status !== "approved") return;

    socket = io(API_BASE_URL);

    socket.on("connect", () => {
      socket.emit("join", userData.id);
    });

    socket.on("receive_message", (data) => {
      if (selectedConversation && data.conversationId === selectedConversation.id) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          content: data.message,
          sender_id: data.senderId,
          sender_role: "industry",
          created_at: data.timestamp,
        }]);
      }
      loadConversations();
    });

    return () => { if (socket) socket.disconnect(); };
  }, [selectedConversation]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data loaders ──
  const loadConversations = async () => {
    const token = localStorage.getItem("token");
    try {
      const res  = await fetch(`${API_BASE_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setConversations(data);
        setUnreadCount(data.reduce((s, c) => s + (c.unread_count || 0), 0));
      }
    } catch (e) { console.error("loadConversations:", e); }
  };

  const loadSupportThread = async (silent = false) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (!silent) setSupportLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/contact/my-support`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log("[Support] thread:", data.thread?.length, "entries, unread:", data.unread_replies);
        setSupportThread(data.thread  || []);
        setSupportUnread(data.unread_replies || 0);
      } else {
        console.error("[Support] fetch failed:", res.status, await res.text());
      }
    } catch (e) { console.error("loadSupportThread:", e); }
    finally { if (!silent) setSupportLoading(false); }
  };

  const loadMessages = async (conversation) => {
    setSelectedConversation(conversation);
    setMessagesLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res  = await fetch(`${API_BASE_URL}/api/conversations/${conversation.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
      loadConversations();
    } catch (e) { console.error("loadMessages:", e); }
    finally { setMessagesLoading(false); }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !selectedConversation) return;
    const token    = localStorage.getItem("token");
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const text     = newMessage;
    const file     = selectedFile;

    setMessages(prev => [...prev, {
      id: Date.now(), content: text || `📎 ${file?.name}`,
      sender_id: userData.id, sender_role: "stakeholder",
      created_at: new Date().toISOString(),
    }]);
    setNewMessage(""); setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    try {
      const form = new FormData();
      if (text) form.append("content", text);
      if (file) form.append("file", file);

      const res = await fetch(`${API_BASE_URL}/api/conversations/${selectedConversation.id}/messages`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form
      });
      if (!res.ok) throw new Error("send failed");

      if (socket?.connected) {
        socket.emit("send_message", {
          conversationId: selectedConversation.id,
          senderId: userData.id,
          receiverId: selectedConversation.industry_user_id,
          message: text || `📎 ${file?.name || "File"}`,
        });
      }
    } catch (e) {
      console.error("sendMessage:", e);
      alert("Failed to send message. Please try again.");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("File must be under 10 MB"); e.target.value = ""; return; }
    setSelectedFile(file);
  };
  
  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) return <div className="messages-page-loading">Loading...</div>;

  return (
    <div className="stakeholder-messages-page">
      <StakeholderNav unreadCount={unreadCount + supportUnread} />

      <div className="messages-container">
        {/* ── Sidebar ── */}
        <div className="conversations-list">
          <div className="messages-tabs">
            <button
              className={`messages-tab ${activeTab === "conversations" ? "active" : ""}`}
              onClick={() => setActiveTab("conversations")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>Chats</span>
              {unreadCount > 0 && <span className="tab-badge">{unreadCount}</span>}
            </button>
            <button
              className={`messages-tab ${activeTab === "support" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("support");
                loadSupportThread();
                setSupportUnread(0);
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span>Support</span>
              {supportUnread > 0 && <span className="tab-badge">{supportUnread}</span>}
            </button>
          </div>

          {activeTab === "conversations" && (
            <>
              <div className="conversations-header">
                <h3>Messages</h3>
                <span className="conversations-count">{conversations.length}</span>
              </div>
              {conversations.length === 0 ? (
                <div className="no-conversations">
                  <p>No conversations yet</p>
                  <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>Start messaging industries from the stakeholders page!</p>
                </div>
              ) : (
                <div className="conversations-scroll">
                  {conversations.map(conv => (
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
                      <div className="conv-meta">
                        {conv.last_message_time && (
                          <span className="conv-time">
                            {new Date(conv.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {conv.unread_count > 0 && <span className="unread-count">{conv.unread_count}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "support" && (
            <>
              <div className="conversations-header">
                <h3>Support</h3>
                {supportUnread > 0 && <span className="conversations-count">{supportUnread}</span>}
              </div>
              <div className="support-sidebar-info">
                <div className="conv-avatar support-avatar">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div className="conv-info">
                  <h4>EthioBridge Support</h4>
                  <p className="last-message">Get help from our support team</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Main area ── */}
        <div className="messages-area">
          {/* Conversations tab */}
          {activeTab === "conversations" && (
            !selectedConversation ? (
              <div className="no-conversation-selected">
                <div className="no-conversation-icon">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    <line x1="9" y1="10" x2="15" y2="10"/>
                    <line x1="9" y1="14" x2="13" y2="14"/>
                  </svg>
                </div>
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
                          className={`message-bubble ${msg.sender_role === 'stakeholder' ? 'sent' : 'received'}`}
                        >
                          <div>
                            {msg.content}
                          </div>
                          {msg.file_url && (
                            <div className="message-attachment">
                              <a href={`${API_BASE_URL}${msg.file_url}`} target="_blank" rel="noopener noreferrer" className="attachment-link">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                                  <polyline points="13 2 13 9 20 9"/>
                                </svg>
                                {msg.file_name || 'Download attachment'}
                              </a>
                            </div>
                          )}
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
                      <div className="file-preview-content">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                          <polyline points="13 2 13 9 20 9"/>
                        </svg>
                        <div className="file-info">
                          <span className="file-name">{selectedFile.name}</span>
                          <span className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                      <button type="button" onClick={removeSelectedFile} className="remove-file-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
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
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                    </button>
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    />
                    <button 
                      className="send-btn"
                      onClick={sendMessage} 
                      disabled={!newMessage.trim() && !selectedFile}
                      title="Send message"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )
          )}

          {/* Support tab */}
          {activeTab === "support" && (
            <>
              <div className="messages-header support-header">
                <div className="industry-info">
                  <div className="industry-avatar support-avatar-header">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <div>
                    <h3>EthioBridge Support</h3>
                    <p>We're here to help you</p>
                  </div>
                </div>
                <button
                  className="support-refresh-btn"
                  onClick={() => loadSupportThread()}
                  title="Refresh messages"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                </button>
              </div>

              <div className="messages-list">
                {supportLoading ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading support messages...</p>
                  </div>
                ) : supportThread.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        <line x1="9" y1="10" x2="15" y2="10"/>
                        <line x1="12" y1="7" x2="12" y2="13"/>
                      </svg>
                    </div>
                    <h4>No support messages yet</h4>
                    <p>Need help? Contact our support team through the Help Center</p>
                    <div className="empty-state-actions">
                      <a href="/help" className="empty-state-btn primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        Help Center
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    {supportThread.map(msg => (
                      <div
                        key={msg.id}
                        className={`message-bubble ${msg.sender === "user" ? "sent" : "received support-reply"}`}
                      >
                        {msg.sender === "admin" && (
                          <div className="support-sender-label">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            <span>Support Team</span>
                          </div>
                        )}
                        {msg.subject && <div className="support-subject">{msg.subject}</div>}
                        <div>{msg.content}</div>
                        <div className="message-time">
                          {new Date(msg.created_at).toLocaleString([], {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit"
                          })}
                          {msg.sender === "user" && msg.status && (
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

              <div className="support-info-banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>To send a new support request, visit the <a href="/help">Help Center</a></span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default StakeholderMessages;