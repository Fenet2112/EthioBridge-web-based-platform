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
              Conversations
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
              Support
              {supportUnread > 0 && <span className="tab-badge">{supportUnread}</span>}
            </button>
          </div>

          {activeTab === "conversations" && (
            conversations.length === 0
              ? <p className="no-conversations">No conversations yet. Start messaging industries from the main page!</p>
              : conversations.map(conv => (
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
                    {conv.unread_count > 0 && <span className="unread-count">{conv.unread_count}</span>}
                  </div>
                ))
          )}

          {activeTab === "support" && (
            <div className="support-sidebar-info">
              <div className="conv-avatar support-avatar">🛡</div>
              <div className="conv-info">
                <h4>EthioBridge Support</h4>
                <p className="last-message">Your support tickets &amp; replies</p>
              </div>
              {supportUnread > 0 && <span className="unread-count">{supportUnread}</span>}
            </div>
          )}
        </div>

        {/* ── Main area ── */}
        <div className="messages-area">

          {/* Conversations tab */}
          {activeTab === "conversations" && (
            !selectedConversation
              ? <div className="no-conversation-selected"><p>Select a conversation to start messaging</p></div>
              : <>
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
                    {messagesLoading ? <p style={{padding:"20px",textAlign:"center"}}>Loading…</p>
                      : messages.length === 0
                        ? <p className="no-messages">No messages yet. Start the conversation!</p>
                        : <>
                            {messages.map(msg => (
                              <div key={msg.id} className={`message-bubble ${msg.sender_role === "stakeholder" ? "sent" : "received"}`}>
                                <div className="message-content">
                                  {msg.content}
                                  {msg.file_url && (
                                    <div className="message-attachment">
                                      <a href={`${API_BASE_URL}${msg.file_url}`} target="_blank" rel="noopener noreferrer" className="attachment-link">
                                        📎 {msg.file_name || "Download"}
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
                    }
                  </div>

                  <div className="message-input-area">
                    {selectedFile && (
                      <div className="selected-file-preview">
                        <span>📎 {selectedFile.name}</span>
                        <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="remove-file-btn">✕</button>
                      </div>
                    )}
                    <div className="input-row">
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: "none" }} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar" />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="attach-btn" title="Attach file">📎</button>
                      <input
                        type="text"
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyPress={e => e.key === "Enter" && sendMessage()}
                      />
                      <button onClick={sendMessage} disabled={!newMessage.trim() && !selectedFile}>Send</button>
                    </div>
                  </div>
                </>
          )}

          {/* Support tab */}
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
                <button
                  className="support-refresh-btn"
                  onClick={() => loadSupportThread()}
                  title="Refresh"
                >↻ Refresh</button>
              </div>

              <div className="messages-list">
                {supportLoading ? (
                  <p style={{ padding: "20px", textAlign: "center" }}>Loading support messages…</p>
                ) : supportThread.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "#6b7280" }}>
                    <p style={{ fontSize: "1.1rem", marginBottom: "8px" }}>No support messages yet.</p>
                    <p style={{ fontSize: "0.9rem" }}>
                      Use the <a href="/contact" style={{ color: "#0a5c2f", fontWeight: 600 }}>Contact Us</a> or{" "}
                      <a href="/help" style={{ color: "#0a5c2f", fontWeight: 600 }}>Help Center</a> page to send a message.
                    </p>
                  </div>
                ) : (
                  <>
                    {supportThread.map(msg => (
                      <div
                        key={msg.id}
                        className={`message-bubble ${msg.sender === "user" ? "sent" : "received support-reply"}`}
                      >
                        {msg.sender === "admin" && (
                          <div className="support-sender-label">🛡 EthioBridge Support</div>
                        )}
                        <div className="message-content">
                          {msg.subject && <div className="support-subject">{msg.subject}</div>}
                          <div>{msg.content}</div>
                        </div>
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

              <div className="support-footer-note">
                <p>
                  To send a new support message, visit the{" "}
                  <a href="/contact">Contact Us</a> or <a href="/help">Help Center</a> page.
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default StakeholderMessages;
