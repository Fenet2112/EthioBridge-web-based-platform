// backend/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// 1. Create the Express app FIRST
const app = express();
const server = http.createServer(app);

// 2. Setup Socket.IO with CORS
const allowedOrigins = [
  'http://localhost:3000',
  process.env.APP_URL,
  /\.vercel\.app$/ // Allow all Vercel preview deployments
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 3. Apply middleware with CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') return allowed === origin;
      if (allowed instanceof RegExp) return allowed.test(origin);
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// 4. Make io accessible to routes
app.set('io', io);

// 5. Import and use routes AFTER app is created
const adminRoutes = require('./src/routes/admin');
app.use('/api/admin', adminRoutes);

const authRoutes = require('./src/routes/auth');
app.use('/api', authRoutes);

const industriesRoutes = require('./src/routes/industries');
app.use('/api', industriesRoutes);

const productsRoutes = require('./src/routes/products');
app.use('/api', productsRoutes);

const purchasesRoutes = require('./src/routes/purchases');
app.use('/api', purchasesRoutes);

const messagesRoutes = require('./src/routes/messages');
app.use('/api', messagesRoutes);

const profileRoutes = require('./src/routes/profile');
app.use('/api/profile', profileRoutes);

const subscriptionRoutes = require('./src/routes/subscription');
app.use('/api', subscriptionRoutes);

const { router: googleAuthRoutes, passport: googlePassport } = require('./src/routes/google-auth');
app.use(googlePassport.initialize());
app.use('/api', googleAuthRoutes);

const cartRoutes = require('./src/routes/cart');
app.use('/api', cartRoutes);

const recommendationRoutes = require('./src/routes/recommendations');
app.use('/api', recommendationRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// 6. Socket.IO connection handling
const connectedUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins with their user ID
  socket.on('join', (userId) => {
    connectedUsers.set(userId.toString(), socket.id);
    console.log(`User ${userId} joined with socket ${socket.id}`);
  });

  // Handle sending messages
  socket.on('send_message', async (data) => {
    const { conversationId, senderId, receiverId, message } = data;
    
    // Emit to receiver if they're online
    const receiverSocketId = connectedUsers.get(receiverId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receive_message', {
        conversationId,
        senderId,
        message,
        timestamp: new Date()
      });
    }
    
    console.log(`Message from ${senderId} to ${receiverId}: ${message}`);
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const { receiverId, isTyping } = data;
    const receiverSocketId = connectedUsers.get(receiverId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', { isTyping });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    // Remove user from connected users
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

// 7. Optional: simple test route
app.get('/', (req, res) => {
  res.json({ message: "EthioBridge Backend is running!" });
});

// 8. Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Socket.IO server ready`);
});