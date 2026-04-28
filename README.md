# EthioBridge — Industry & Stakeholder Connection Platform

<div align="center">

![EthioBridge](https://img.shields.io/badge/EthioBridge-v1.0-0a5c2f?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql)
![Python](https://img.shields.io/badge/Python-FastAPI-009688?style=for-the-badge&logo=fastapi)

**Ethiopia's leading B2B marketplace connecting construction industries, suppliers, and stakeholders.**

[Live Demo](https://etbd.vercel.app) · [Backend API](https://ethiobridge-web-based-platform.onrender.com) · [ML Service](https://ethiobridge-ml.onrender.com)

</div>

---

## 📌 Description

EthioBridge is a production-grade, full-stack B2B web platform built to bridge the gap between **construction industries** (suppliers, manufacturers, producers) and **stakeholders** (investors, contractors, buyers) across Ethiopia.

The platform goes beyond a simple directory — it provides a complete business workflow including product discovery, purchase request management, real-time messaging, intelligent AI-powered recommendations, and a comprehensive admin control panel.

> This is not a demo or student project. EthioBridge is designed and deployed as a real-world marketplace with live users, persistent data, and production infrastructure.

---

## ✨ Features

### 🔐 Authentication & Security
- JWT-based authentication with role separation
- Google OAuth 2.0 login
- Email verification on signup
- Password reset via email token
- Admin uses a separate JWT secret (`ADMIN_JWT_SECRET`)

### 👥 Role-Based Access Control
| Role | Capabilities |
|------|-------------|
| **Admin** | Approve/reject users, manage all data, view analytics, configure system settings |
| **Industry** | List products, manage purchase requests, message stakeholders, view analytics |
| **Stakeholder** | Browse industries, send purchase requests, message industries, get recommendations |

### 🏭 Industry Management
- Company profile with logo, sector, location, GPS coordinates
- Product catalog with images (stored on Supabase Storage)
- Discount badges, new/popular product labels
- Business role classification (Supplier / Manufacturer / Producer)

### 🛒 Purchase Request System
- Stakeholders send purchase requests per product
- Free tier: configurable request limit (admin-controlled)
- Premium subscription: unlimited requests
- ID verification for first-time unverified users
- Cart system with localStorage + database persistence
- Full checkout flow with per-item notes

### 💬 Messaging System
- Real-time messaging via Socket.IO
- Industry ↔ Stakeholder direct conversations
- File attachment support (images, PDFs, documents)
- Unread message badges
- WhatsApp-style chat UI with message timestamps

### 🤖 Recommendation System (ML)
- Hybrid approach: KNN + SVD + Content-Based + Popularity
- Personalized product and industry recommendations
- Trained on purchase history and interaction data
- Separate FastAPI microservice with hot-swap retraining
- Graceful fallback to popularity-based when model unavailable

### 📊 Admin Dashboard
- User approval workflow (manual / automatic / conditional)
- Purchase request management
- Industry and product oversight
- Analytics with charts (success rate, revenue, request trends)
- Support ticket system with admin reply → user notification
- System settings (free request limit, max products, notifications)
- Approval decision audit logs

### 🔔 Notification System
- In-app notifications for approvals, messages, purchase updates
- Email notifications via Gmail SMTP (Nodemailer)
- Support ticket replies delivered to user's messages section

### 🔍 Advanced Filtering & Search
- Filter products by category, price range, location, business role
- Filter industries by sector, location, product count
- Distance-based sorting using GPS coordinates
- Pagination on all listing pages

### 💳 Subscription System
- Free tier with configurable limits
- Premium plan via Chapa payment gateway
- Subscription status controls messaging and request limits

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        USER                             │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────┐
│              FRONTEND (React + Vite)                    │
│                  Vercel CDN                             │
│  Pages: Home, Stakeholders, Industry, Products,         │
│         Admin Dashboard, Messages, Recommendations      │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API + Socket.IO
┌─────────────────────▼───────────────────────────────────┐
│           BACKEND API (Node.js + Express)               │
│                  Render.com                             │
│  Routes: auth, industries, products, purchases,         │
│          messages, recommendations, admin, contact      │
└──────────┬──────────────────────────┬───────────────────┘
           │ SQL (pg)                 │ HTTP
┌──────────▼──────────┐   ┌──────────▼──────────────────┐
│  PostgreSQL Database │   │   ML Service (FastAPI)       │
│  Supabase (hosted)  │   │   Render.com                 │
│                     │   │   KNN + SVD + Content-Based  │
│  Tables:            │   │   /recommend/products        │
│  users, industries, │   │   /recommend/industries      │
│  products, messages,│   │   /train (background)        │
│  purchase_requests, │   └─────────────────────────────┘
│  conversations,     │
│  notifications,     │
│  testimonials,      │
│  system_settings    │
└─────────────────────┘
           │ Storage
┌──────────▼──────────┐
│  Supabase Storage   │
│  product-images     │
│  profile-images     │
│  id-documents       │
└─────────────────────┘
```

---

## 🛠️ Technologies Used

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 | UI framework |
| React Router v6 | Client-side routing |
| Socket.IO Client | Real-time messaging |
| React Icons | Icon library |
| Recharts | Analytics charts |
| Leaflet.js | Interactive map (Explore page) |

### Backend
| Technology | Purpose |
|-----------|---------|
| Node.js + Express | REST API server |
| Socket.IO | WebSocket real-time messaging |
| PostgreSQL (pg) | Primary database |
| Nodemailer | Email delivery (Gmail SMTP) |
| Multer | File upload handling |
| JWT (jsonwebtoken) | Authentication tokens |
| bcryptjs | Password hashing |
| @supabase/supabase-js | Storage SDK |

### ML Service
| Technology | Purpose |
|-----------|---------|
| Python 3.11 | Runtime |
| FastAPI | API framework |
| scikit-learn | KNN, SVD, cosine similarity |
| NumPy | Numerical operations |
| psycopg2 | PostgreSQL connection |
| pickle | Model serialization |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Vercel | Frontend hosting + CDN |
| Render | Backend + ML service hosting |
| Supabase | PostgreSQL database + file storage |
| Gmail SMTP | Transactional email |
| Chapa | Payment gateway (Ethiopia) |

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js ≥ 18
- Python ≥ 3.11
- PostgreSQL (or Supabase account)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/EthioBridge-web-based-platform.git
cd EthioBridge-web-based-platform
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env` (see [Environment Variables](#-environment-variables)):

```bash
cp backend/.env.example backend/.env
# Edit .env with your values
```

Run database migrations:

```bash
node run-migrations.js
```

Start the backend:

```bash
npm start
# or for development:
npm run dev
```

Backend runs on `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```bash
REACT_APP_API_URL=http://localhost:5000
```

Start the frontend:

```bash
npm start
```

Frontend runs on `http://localhost:3000`

### 4. ML Service Setup

```bash
cd ml-service
pip install -r requirements.txt
```

Train the initial model:

```bash
python train_model.py
```

Start the ML service:

```bash
uvicorn main:app --reload --port 8000
```

ML service runs on `http://localhost:8000`

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

```env
# Server
PORT=5000
NODE_ENV=development

# Database (Supabase)
DATABASE_URL=postgresql://user:password@host:5432/postgres
DB_HOST=your-supabase-host
DB_NAME=postgres
DB_USER=postgres.your-project-ref
DB_PASSWORD=your-db-password
DB_PORT=5432
DB_SSL=true

# Supabase Storage
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-super-secret-jwt-key
ADMIN_JWT_SECRET=your-admin-jwt-secret

# Admin Credentials
ADMIN_EMAIL=admin@ethiobridge.et
ADMIN_PASSWORD=your-admin-password

# Email (Gmail SMTP)
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-char-app-password

# URLs
APP_URL=https://etbd.vercel.app
BACKEND_URL=https://ethiobridge-web-based-platform.onrender.com

# ML Service
ML_SERVICE_URL=http://localhost:8000

# Payment
CHAPA_SECRET_KEY=your-chapa-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Frontend (`frontend/.env`)

```env
REACT_APP_API_URL=http://localhost:5000
```

### ML Service

The ML service reads database credentials from `backend/.env` automatically via `python-dotenv`.

---

## 📡 API Overview

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/signup` | Register new user |
| `POST` | `/api/login` | Login and receive JWT |
| `POST` | `/api/admin/login` | Admin login |
| `GET` | `/api/verify-email` | Verify email token |
| `POST` | `/api/forgot-password` | Request password reset |

### Industries & Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/industries` | List approved industries |
| `GET` | `/api/industries/:id` | Industry detail + trust metrics |
| `GET` | `/api/products/all` | Browse all products with filters |
| `POST` | `/api/products` | Create product (industry) |
| `PUT` | `/api/products/:id` | Update product |
| `DELETE` | `/api/products/:id` | Delete product |

### Purchase Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/purchases` | Submit purchase request |
| `GET` | `/api/purchases/my-requests` | Stakeholder's requests |
| `GET` | `/api/purchases/industry-requests` | Industry's incoming requests |
| `PATCH` | `/api/admin/purchases/:id/approve` | Admin approve |
| `PATCH` | `/api/admin/purchases/:id/reject` | Admin reject |

### Messaging
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/conversations` | List conversations |
| `GET` | `/api/conversations/:id/messages` | Get messages |
| `POST` | `/api/conversations/:id/messages` | Send message |
| `POST` | `/api/conversations/create` | Start conversation |

### Recommendations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/recommendations/products` | Personalized product recs |
| `GET` | `/api/recommendations/industries` | Industry recommendations |

### Cart
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cart` | Get cart items |
| `POST` | `/api/cart` | Add to cart |
| `PATCH` | `/api/cart/:product_id` | Update quantity |
| `DELETE` | `/api/cart/:product_id` | Remove item |
| `POST` | `/api/cart/sync` | Sync guest cart on login |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/users/all` | All users with filters |
| `GET` | `/api/admin/pending` | Pending approvals |
| `PATCH` | `/api/admin/users/:id/approve` | Approve user |
| `PATCH` | `/api/admin/users/:id/reject` | Reject user |
| `GET` | `/api/admin/analytics` | Platform analytics |
| `GET` | `/api/admin/settings/general` | System settings |
| `PUT` | `/api/admin/settings/general` | Update system settings |

---

## 🤖 Recommendation System

EthioBridge uses a **hybrid machine learning pipeline** that combines multiple strategies for accurate, personalized recommendations.

### Architecture

```
User Request
     │
     ▼
Has purchase history?
     │
  YES │                    NO
     ▼                     ▼
Collaborative          Content-Based
Filtering              + Popularity
(KNN + SVD)
     │                     │
     └──────────┬──────────┘
                ▼
         Hybrid Score
    0.35×content + 0.25×popularity
    + 0.40×collaborative
                │
                ▼
         Top-N Results
```

### Algorithms

| Algorithm | Role | Weight |
|-----------|------|--------|
| **KNN** (k-Nearest Neighbors) | Find users with similar purchase history | 60% of collaborative |
| **SVD** (Truncated SVD) | Latent factor similarity in user space | 40% of collaborative |
| **Cosine Similarity** | Match query vector to product features | Content component |
| **Popularity Score** | Frequency-based fallback | Baseline signal |

### Feature Engineering

Each product is encoded into a **22-dimensional vector**:
- Dimensions 0–17: Multi-hot keyword match (18 known categories)
- Dimension 18: Encoded category (normalised)
- Dimension 19: Encoded sector (normalised)
- Dimension 20: Encoded business role (normalised)
- Dimension 21: Normalised price (capped at 500,000 ETB)

### Training

```bash
# Train offline
python ml-service/train_model.py

# Trigger hot-swap retraining via API
curl -X POST https://your-ml-service.onrender.com/train
```

### Evaluation

Hit Rate@10 — leave-one-out evaluation on users with ≥2 interactions. A score of 0.4 means 40% of the time the system correctly recommends a product the user would have purchased.

---

## 🌐 Deployment

### Frontend — Vercel

```bash
cd frontend
npm run build
# Deploy via Vercel CLI or GitHub integration
vercel --prod
```

**Environment variables** set in Vercel dashboard:
```
REACT_APP_API_URL=https://ethiobridge-web-based-platform.onrender.com
```

### Backend — Render

- **Build command:** `npm install`
- **Start command:** `node src/server.js`
- **Environment:** Set all variables from `backend/.env` in Render dashboard

### ML Service — Render

- **Build command:** `pip install -r requirements.txt && python train_model.py`
- **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Runtime:** Python 3.11.9 (set in `runtime.txt`)

---

## 📁 Project Structure

```
EthioBridge/
├── frontend/                  # React application
│   ├── public/                # Static assets, favicon
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── contexts/          # React context (Auth, etc.)
│   │   ├── hooks/             # Custom hooks (useCart, etc.)
│   │   ├── pages/             # Page components
│   │   │   ├── admin/         # Admin dashboard pages
│   │   │   └── views/         # Admin sub-views
│   │   └── utils/             # Helpers (imageUrl, distance)
│   └── package.json
│
├── backend/                   # Node.js API server
│   └── src/
│       ├── config/            # Database connection
│       ├── middleware/        # Auth middleware
│       ├── routes/            # API route handlers
│       ├── services/          # Business logic (approval workflow)
│       └── utils/             # Email, notifications, uploads
│
├── ml-service/                # Python ML microservice
│   ├── main.py                # FastAPI app + inference endpoints
│   ├── train_model.py         # Offline training pipeline
│   ├── preprocessor.py        # Feature engineering
│   ├── model_store.py         # Model persistence helpers
│   ├── models/                # Saved model files (.pkl)
│   └── requirements.txt
│
└── database/
    └── migrations/            # SQL migration files (001–022)
```

---

## 🔮 Future Improvements

- [ ] **Real-time notifications** via WebSocket push (currently polling)
- [ ] **Mobile application** (React Native)
- [ ] **Advanced payment integration** — Telebirr, CBE Birr, bank transfer
- [ ] **AI-powered forecasting** — demand prediction for industries
- [ ] **Multi-language support** — Amharic + English
- [ ] **Verified badge system** — document-based industry verification
- [ ] **Bulk order management** — multi-product purchase requests
- [ ] **Industry analytics export** — CSV/PDF reports
- [ ] **Periodic ML retraining** — automated weekly model updates

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 👤 Author

**Fenet** — Full-Stack Developer  
📧 fenufen491@gmail.com  
🌐 [EthioBridge Platform](https://etbd.vercel.app)

---

<div align="center">
  <sub>Built with ❤️ for Ethiopia's construction industry</sub>
</div>
