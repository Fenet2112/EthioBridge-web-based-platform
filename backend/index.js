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
  'https://etbd.vercel.app', // Production Vercel deployment
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
  origin: true, // Allow all origins temporarily for debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Socket.IO server ready`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Test database connection after server starts
  const pool = require('./src/config/db');
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
      console.error('Server will continue running but database operations will fail');
    } else {
      console.log('✅ Database connected successfully');
    }
  });
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err);
  process.exit(1);
});