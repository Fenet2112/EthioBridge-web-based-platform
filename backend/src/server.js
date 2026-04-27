require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const pool = require("./config/db");

const app = express();
const server = http.createServer(app);

// ══════════════════════════════════════
// GLOBAL ERROR HANDLERS
// ══════════════════════════════════════

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  // Log but don't exit - let PM2 or process manager handle restart if needed
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  // Log but don't exit
});

// Handle warnings
process.on('warning', (warning) => {
  console.warn('⚠️  WARNING:', warning.name);
  console.warn('Message:', warning.message);
  console.warn('Stack:', warning.stack);
});

// ══════════════════════════════════════
// SOCKET.IO SETUP
// ══════════════════════════════════════
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Log incoming request
  console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.url}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// ── Routes ──
const authRoutes = require("./routes/auth.js");
const adminRoutes = require("./routes/admin.js");
const industryRoutes = require("./routes/industries.js");
const productRoutes = require("./routes/products.js");
const purchaseRoutes = require("./routes/purchases.js");
const messageRoutes = require("./routes/messages.js");
const subscriptionRoutes = require("./routes/subscription.js");
const profileRoutes = require("./routes/profile.js");
const contactRoutes = require("./routes/contact.js");
const notificationRoutes = require("./routes/notifications.js");

app.use("/api", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/industries", industryRoutes);
app.use("/api", productRoutes);
app.use("/api", purchaseRoutes);
app.use("/api", messageRoutes);
app.use("/api", subscriptionRoutes);
app.use("/api", profileRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/industry/notifications", notificationRoutes);

// Test routes
app.get("/", (req, res) => {
  res.json({ message: "EthioBridge Backend API is running" });
});

app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is alive! 🚀" });
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    // Check database connection
    const dbHealth = await pool.healthCheck();
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const memoryMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    // Check uptime
    const uptimeSeconds = process.uptime();
    const uptimeFormatted = `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${Math.floor(uptimeSeconds % 60)}s`;
    
    const health = {
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: uptimeFormatted,
      uptimeSeconds: Math.floor(uptimeSeconds),
      database: dbHealth,
      memory: memoryMB,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      pid: process.pid
    };
    
    const statusCode = dbHealth.healthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ── Socket.io: Real-time Messaging ──
const JWT_SECRET = process.env.JWT_SECRET || "ethiobridge-secret-key";

io.use((socket, next) => {
  // Auth middleware – verify JWT from handshake auth
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("Authentication error: no token"));
  }
  try {
    const user = jwt.verify(token, JWT_SECRET);
    socket.user = user;
    next();
  } catch (err) {
    next(new Error("Authentication error: invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log(`Socket connected: user ${socket.user.id} (${socket.user.role})`);

  // Join a conversation room
  socket.on("join_conversation", async (conversationId) => {
    try {
      // Verify user belongs to this conversation
      const result = await pool.query(`
        SELECT c.id FROM conversations c
        JOIN stakeholders s ON s.id = c.stakeholder_id
        JOIN industries i ON i.id = c.industry_id
        WHERE c.id = $1 AND (s.user_id = $2 OR i.user_id = $2)
      `, [conversationId, socket.user.id]);

      if (result.rows.length > 0) {
        socket.join(`conversation_${conversationId}`);
        console.log(`User ${socket.user.id} joined room conversation_${conversationId}`);
      } else {
        socket.emit("error", { message: "Not authorized for this conversation" });
      }
    } catch (err) {
      console.error("join_conversation error:", err);
    }
  });

  // Send a message
  socket.on("send_message", async ({ conversationId, content }) => {
    if (!content || !content.trim()) return;

    try {
      // Save to DB
      const result = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3) RETURNING *`,
        [conversationId, socket.user.id, content.trim()]
      );
      const message = result.rows[0];

      // Fetch sender name
      const senderRes = await pool.query(`
        SELECT u.role, COALESCE(i.company_name, s.organization_name) AS sender_name
        FROM users u
        LEFT JOIN industries i ON i.user_id = u.id
        LEFT JOIN stakeholders s ON s.user_id = u.id
        WHERE u.id = $1
      `, [socket.user.id]);

      const senderName = senderRes.rows[0]?.sender_name || socket.user.email;

      const outMessage = {
        ...message,
        sender_id: socket.user.id,
        sender_name: senderName,
        sender_role: socket.user.role,
      };

      // Broadcast to all room members (including sender)
      io.to(`conversation_${conversationId}`).emit("new_message", outMessage);
    } catch (err) {
      console.error("send_message error:", err);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Typing indicators
  socket.on("typing", ({ conversationId }) => {
    socket.to(`conversation_${conversationId}`).emit("user_typing", {
      userId: socket.user.id,
    });
  });

  socket.on("stop_typing", ({ conversationId }) => {
    socket.to(`conversation_${conversationId}`).emit("user_stop_typing", {
      userId: socket.user.id,
    });
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: user ${socket.user.id}`);
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.url} - Route not found`);
  res.status(404).json({ message: "Endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  console.error('Error stack:', err.stack);
  console.error('Request:', {
    method: req.method,
    url: req.url,
    body: req.body,
    headers: req.headers
  });
  
  // Don't leak error details in production
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(err.status || 500).json({ 
    message: errorMessage,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Socket.IO server ready`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Test database connection after server starts
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
    } else {
      console.log('✅ Database connected successfully');
    }
  });

  // Auto-create system_settings table if it doesn't exist
  pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id                        SERIAL PRIMARY KEY,
      free_request_limit        INTEGER NOT NULL DEFAULT 1,
      max_products_free         INTEGER NOT NULL DEFAULT 5,
      email_alerts_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
      purchase_alerts_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).then(() => pool.query(`
    INSERT INTO system_settings (id, free_request_limit, max_products_free, email_alerts_enabled, purchase_alerts_enabled)
    VALUES (1, 1, 5, true, true)
    ON CONFLICT (id) DO NOTHING
  `)).then(() => {
    console.log('✅ system_settings table ready');
  }).catch(err => {
    console.error('⚠️  system_settings setup failed (non-fatal):', err.message);
  });

  // Ensure Supabase Storage buckets exist
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
    const buckets = ['product-images', 'profile-images', 'id-documents'];
    buckets.forEach(async (bucket) => {
      try {
        const { data: existing } = await sb.storage.getBucket(bucket);
        if (!existing) {
          const { error } = await sb.storage.createBucket(bucket, { public: true });
          if (error) console.error(`[Storage] Failed to create bucket ${bucket}:`, error.message);
          else console.log(`[Storage] ✅ Created bucket: ${bucket}`);
        } else {
          console.log(`[Storage] ✅ Bucket exists: ${bucket}`);
        }
      } catch (e) {
        console.error(`[Storage] Bucket check failed for ${bucket}:`, e.message);
      }
    });
  } else {
    console.warn('[Storage] ⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — profile photos will use local disk (not persistent on Render)');
  }
});

// Set keep-alive timeout (important for cloud deployments)
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // Must be greater than keepAliveTimeout

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed');
    
    // Close database pool
    try {
      await pool.end();
      console.log('Database pool closed');
    } catch (err) {
      console.error('Error closing database pool:', err);
    }
    
    // Close Socket.IO
    io.close(() => {
      console.log('Socket.IO closed');
    });
    
    console.log('Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
