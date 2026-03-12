# Real-Time Messaging System Setup

## Installation Steps

### 1. Install Socket.IO Client (Frontend)
```bash
cd frontend
npm install socket.io-client
```

### 2. Restart Backend Server
The backend has been updated with Socket.IO support. Restart it:
```bash
cd backend
npm start
```

### 3. Restart Frontend
```bash
cd frontend
npm start
```

## How to Use

### For Stakeholders:
1. Browse industries and view their products
2. Click "Message Industry" button on purchase requests
3. A chat box will appear in the bottom-right corner
4. Send messages in real-time!

### For Industries:
1. Go to "Purchase Requests" section
2. Click "Message Stakeholder" button
3. Chat box opens for real-time communication

## Features Implemented

✅ Real-time messaging using Socket.IO
✅ Messages stored in PostgreSQL database
✅ Typing indicators
✅ Message read status
✅ Auto-scroll to latest message
✅ Beautiful gradient UI design
✅ Online/offline status handling
✅ Message timestamps
✅ Conversation persistence

## Database Schema

The system uses the existing `messages` and `conversations` tables:

- **conversations**: Links stakeholders and industries
- **messages**: Stores all chat messages with sender_id, content, timestamps

## Technical Details

- **Backend**: Socket.IO server integrated with Express
- **Frontend**: Socket.IO client in React component
- **Real-time events**:
  - `join`: User connects with their ID
  - `send_message`: Send a message
  - `receive_message`: Receive a message
  - `typing`: Typing indicator
  - `user_typing`: Receive typing status

## Next Steps

To integrate the ChatBox component into your pages:

```javascript
import ChatBox from '../components/ChatBox';

// In your component:
const [showChat, setShowChat] = useState(false);
const [chatData, setChatData] = useState(null);

// Open chat:
<button onClick={() => {
  setChatData({
    conversationId: req.conversation_id,
    receiverId: req.stakeholder_user_id,
    receiverName: req.organization_name
  });
  setShowChat(true);
}}>
  Message Stakeholder
</button>

// Render chat:
{showChat && chatData && (
  <ChatBox
    conversationId={chatData.conversationId}
    receiverId={chatData.receiverId}
    receiverName={chatData.receiverName}
    onClose={() => setShowChat(false)}
  />
)}
```

## Testing

1. Open two browser windows
2. Log in as stakeholder in one, industry in another
3. Start a conversation
4. Messages appear instantly in both windows!
