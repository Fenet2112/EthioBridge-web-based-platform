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
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
  }, [navigate]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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
      sender_role: 'stakeholder',
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
          receiverId: selectedConversation.industry_user_id,
          message: messageText
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  if (loading) {
    return <div className="messages-page-loading">Loading...</div>;
  }

  return (
    <div className="stakeholder-messages-page">
      <StakeholderNav unreadCount={unreadCount} />

      <div className="messages-container">
        {/* Conversations List */}
        <div className="conversations-list">
          <h3>Conversations</h3>
          {conversations.length === 0 ? (
            <p className="no-conversations">
              No conversations yet. Start messaging industries from the main page!
            </p>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                onClick={() => loadMessages(conv)}
              >
                <div className="conv-avatar">{conv.company_name?.charAt(0) || 'I'}</div>
                <div className="conv-info">
                  <h4>{conv.company_name}</h4>
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
                <div className="industry-info">
                  <div className="industry-avatar">{selectedConversation.company_name?.charAt(0) || 'I'}</div>
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
  );
}

export default StakeholderMessages;
