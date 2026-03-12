require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const pool = require("./config/db");

const app = express();
const server = http.createServer(app);

// ── Socket.io setup ──
const io = new Server(server, {
  cors: {
    origin: process.env.APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// ── Routes ──
const authRoutes = require("./routes/auth.js");
const adminRoutes = require("./routes/admin.js");
const industryRoutes = require("./routes/industries.js");
const productRoutes = require("./routes/products.js");
const purchaseRoutes = require("./routes/purchases.js");
const messageRoutes = require("./routes/messages.js");

app.use("/api", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", industryRoutes);
app.use("/api", productRoutes);
app.use("/api", purchaseRoutes);
app.use("/api", messageRoutes);

// Test routes
app.get("/", (req, res) => {
  res.json({ message: "EthioBridge Backend API is running" });
});
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is alive! 🚀" });
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
  res.status(404).json({ message: "Endpoint not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
