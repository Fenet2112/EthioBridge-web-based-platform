import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function ChatBox({ conversationId, receiverId, receiverName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const userData = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');

  // Initialize Socket.IO
  useEffect(() => {
    const newSocket = io(API_BASE_URL);
    setSocket(newSocket);

    // Join with user ID
    newSocket.emit('join', userData.id);

    // Listen for incoming messages
    newSocket.on('receive_message', (data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          content: data.message,
          sender_id: data.senderId,
          created_at: data.timestamp,
          sender_name: receiverName
        }]);
      }
    });

    // Listen for typing indicator
    newSocket.on('user_typing', (data) => {
      setIsTyping(data.isTyping);
    });

    return () => newSocket.close();
  }, [conversationId, userData.id, receiverName]);

  // Load existing messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setMessages(data);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };

    if (conversationId) {
      fetchMessages();
    }
  }, [conversationId, token]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    const messageData = {
      conversationId,
      senderId: userData.id,
      receiverId,
      message: newMessage.trim()
    };

    // Send via Socket.IO
    socket.emit('send_message', messageData);

    // Also save to database via REST API
    try {
      await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newMessage.trim() })
      });

      // Add to local messages
      setMessages(prev => [...prev, {
        id: Date.now(),
        content: newMessage.trim(),
        sender_id: userData.id,
        created_at: new Date(),
        sender_name: 'You'
      }]);

      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleTyping = () => {
    if (socket) {
      socket.emit('typing', { receiverId, isTyping: true });

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', { receiverId, isTyping: false });
      }, 2000);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '400px',
      height: '600px',
      background: 'white',
      borderRadius: '16px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px',
        borderRadius: '16px 16px 0 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px' }}>{receiverName}</h3>
          {isTyping && <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.9 }}>typing...</p>}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '18px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        background: '#f8f9fa'
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: '16px',
              display: 'flex',
              justifyContent: msg.sender_id === userData.id ? 'flex-end' : 'flex-start'
            }}
          >
            <div style={{
              maxWidth: '70%',
              padding: '12px 16px',
              borderRadius: '12px',
              background: msg.sender_id === userData.id
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'white',
              color: msg.sender_id === userData.id ? 'white' : '#212529',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                {msg.content}
              </p>
              <p style={{
                margin: '4px 0 0',
                fontSize: '11px',
                opacity: 0.7,
                textAlign: 'right'
              }}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} style={{
        padding: '16px',
        borderTop: '1px solid #e9ecef',
        display: 'flex',
        gap: '8px'
      }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: '12px 16px',
            border: '1px solid #dee2e6',
            borderRadius: '24px',
            fontSize: '14px',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
            fontSize: '20px',
            opacity: newMessage.trim() ? 1 : 0.5
          }}
        >
          ➤
        </button>
      </form>
    </div>
  );
}

export default ChatBox;
