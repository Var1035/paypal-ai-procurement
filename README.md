# AgentMarket — AI-Powered B2B Procurement Marketplace

> **Multi-Agent Autonomous Negotiation Platform** built for the PayPal AI Hackathon  
> Buyer and Seller AI agents negotiate in real-time, backed by graph-based market intelligence and PayPal Sandbox payments.

---

## What Does This Do?

AgentMarket is a **full-stack B2B procurement platform** where a buyer types a natural-language purchase request (e.g., *"I need 500 ergonomic office chairs under 4000 each, delivered in 10 days"*), and two AI agents — one representing the **buyer** and one representing the **seller** — autonomously negotiate price, quantity, and delivery terms across multiple rounds.

### The Core Workflow

```
Buyer types a request
        │
        ▼
  Buyer AI Agent (DeepSeek-R1)
  Parses intent, finds matching products,
  proposes an opening bid
        │
        ▼
  Seller AI Agent (Qwen 2.5)
  Evaluates the bid against catalog pricing,
  past transaction history (FalkorDB), and
  margin thresholds. Counters or accepts.
        │
        ▼
  Multi-round negotiation (up to 8 rounds)
  Each round streams live to both dashboards
        │
        ▼
  Agreement reached or stalemate
        │
        ▼
  Human approval (Buyer confirms, Seller confirms)
        │
        ▼
  PayPal Sandbox checkout and order creation
```

### Key Capabilities

- **Natural Language Procurement** — Buyers describe what they need in plain English. The AI parses quantity, budget, delivery timeline, and product type.
- **Multi-Agent Bounded Negotiation** — Two locally-hosted LLMs (via Ollama) negotiate autonomously with configurable round limits and convergence detection.
- **Live Negotiation Streaming** — Each negotiation round streams to the UI in real-time. Buyers and sellers see the conversation as it happens.
- **FalkorDB Graph Intelligence** — Historical transaction data stored in a graph database powers the seller agent's pricing decisions — past volumes, delivery scores, and category benchmarks.
- **Seller Takeover Mode** — Sellers can click "Take Over" to pause the AI agent and manually respond. Click "Hand Over to AI" to resume autonomous negotiation.
- **Two-Sided Human Approval** — Both buyer and seller must approve the final negotiated terms before payment proceeds.
- **PayPal Sandbox Payments** — Orders are settled via PayPal's sandbox API with server-side order creation and capture.
- **200-Product Catalog** — Pre-seeded with 200 verified products across 40 supplier companies, sourced from an Excel dataset.
- **Dark/Light Theme** — Full theme support with system preference detection.

---

## Architecture

```
                    ┌──────────────────┐
                    │   React Frontend │
                    │  (Vite + Tailwind)│
                    │   Port 5173      │
                    └────────┬─────────┘
                             │
                        /api proxy
                             │
                    ┌────────┴─────────┐
                    │  Express Backend │
                    │   Port 5000      │
                    └───┬─────────┬────┘
                        │         │
              ┌─────────┘    ┌────┴────────┐
              │              │             │
     ┌────────┴──┐    ┌──────┴─────┐  ┌────┴──────┐
     │  Supabase  │   │  FalkorDB  │  │  Ollama   │
     │ (Postgres) │   │  (Graph)   │  │  (Local)  │
     │  Products  │   │ Tx History │  │   LLMs    │
     │  Orders    │   │ Delivery   │  │ DeepSeek  │
     │  Messages  │   │ Scores     │  │  Qwen 2.5 │
     └────────────┘   └────────────┘  └─────┬─────┘
                                            │
                                      ┌─────┴──────┐
                                      │   PayPal   │
                                      │  Sandbox   │
                                      └────────────┘
```

### How the AI Agents Work

**Buyer Agent** (`DeepSeek-R1:14b` via Ollama)
- Parses the buyer's natural language request into structured procurement parameters
- Searches the product catalog for matching items
- Opens negotiation with a bid based on the buyer's budget and strategy (aggressive / balanced / conservative)
- Counters seller offers using budget constraints and target pricing

**Seller Agent** (`Qwen 2.5:14b` via Ollama)
- Evaluates incoming bids against the product's base price and catalog margin
- Queries FalkorDB for historical transaction context — past sale prices, volume discounts, and delivery performance
- Makes counter-offers factoring in floor price, batch volume, and competitive positioning
- Can be overridden by a human seller at any time via "Take Over" mode

**Convergence Detection**  
The system detects when buyer and seller prices are within a configurable threshold (default: 5%) and proposes a midpoint settlement. If no agreement is reached after the maximum rounds, the negotiation ends in a stalemate.

---

## Project Structure

```
paypal-ai-procurement/
├── package.json                          # Root workspace — runs frontend + backend concurrently
├── vite.config.ts                        # Vite dev server config with /api proxy to backend
├── index.html                            # SPA entry point
├── .env.example                          # Environment variable template (never commit real .env)
├── .gitignore                            # Git ignore rules
├── abstract.txt                          # Original project specification document
├── agentmarket_40_company_product_dataset.xlsx
│                                         # Source dataset (40 companies, 200 products)
│
├── shared/                               # Shared TypeScript contracts
│   ├── contracts.ts                      # Zod schemas for health, error, and domain data
│   ├── database.types.ts                 # Supabase auto-generated database type definitions
│   └── index.ts                          # Canonical re-exports
│
├── src/                                  # React 19 Frontend (TypeScript + Tailwind CSS 4)
│   ├── main.tsx                          # Application entry — renders App into DOM
│   ├── App.tsx                           # Root router — defines all page routes
│   ├── index.css                         # Global styles, design tokens, Tailwind config
│   ├── App.css                           # Minimal app-level styles
│   │
│   ├── pages/
│   │   ├── LandingPage.tsx               # Homepage — hero section, feature showcase
│   │   ├── AISourcingPage.tsx            # Buyer dashboard — product search, AI chat, negotiation
│   │   ├── SellerHubPage.tsx             # Seller dashboard — manage negotiations, takeover mode
│   │   ├── BuyerAgentsPage.tsx           # Buyer's active AI agent configurations
│   │   └── FalkorDBGraphPage.tsx         # Graph visualization of market intelligence data
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx                # Top navigation bar with route links
│   │   │   └── AuthNavControls.tsx       # Login/signup modals and session controls
│   │   │
│   │   ├── ui/
│   │   │   ├── MaterialIcon.tsx          # Google Material Icons wrapper component
│   │   │   ├── ThemeToggle.tsx           # Dark/light theme switch
│   │   │   ├── ai-thiking-orb-and-input.tsx
│   │   │   │                             # Animated AI thinking orb + chat input
│   │   │   ├── how-it-works.tsx          # Animated "How It Works" explainer section
│   │   │   ├── prisma-hero.tsx           # Glassmorphism hero banner component
│   │   │   ├── seller-hub.tsx            # Seller dashboard UI components
│   │   │   └── demo.tsx                  # Demo placeholder component
│   │   │
│   │   ├── negotiation/
│   │   │   └── NegotiationDetailModal.tsx
│   │   │                                 # Full negotiation transcript modal (round-by-round)
│   │   │
│   │   └── payment/
│   │       └── PayPalCheckoutModal.tsx   # PayPal Sandbox checkout flow modal
│   │
│   ├── context/
│   │   ├── AuthContext.tsx               # Authentication state — login, signup, session
│   │   ├── MarketplaceContext.tsx        # Global state — products, negotiations, orders
│   │   └── ThemeContext.tsx              # Theme preference state (dark/light/system)
│   │
│   ├── services/
│   │   └── apiClient.ts                 # Typed HTTP client — all frontend-to-backend API calls
│   │
│   ├── lib/                              # Utility functions and helpers
│   └── assets/                           # Static assets (images, icons)
│
├── server/                               # Express.js Backend (TypeScript + Node.js)
│   ├── package.json                      # Backend dependencies and scripts
│   ├── tsconfig.json                     # TypeScript config (NodeNext modules)
│   ├── vitest.config.ts                  # Test runner configuration
│   │
│   └── src/
│       ├── index.ts                      # Server entry — starts Express on configured port
│       ├── app.ts                        # Express app — middleware, routes, error handling
│       │
│       ├── config/
│       │   └── env.ts                    # Zod-validated environment config
│       │
│       ├── middleware/
│       │   └── errorHandler.ts           # Centralized error handling middleware
│       │
│       ├── routes/
│       │   ├── health.ts                 # GET /api/health — service status dashboard
│       │   ├── products.ts               # CRUD for product catalog (Supabase)
│       │   ├── suppliers.ts              # Supplier management and lookup
│       │   ├── procurement.ts            # Procurement request lifecycle
│       │   ├── negotiation.ts            # Multi-round AI negotiation engine (core)
│       │   ├── orders.ts                 # Order creation and status tracking
│       │   ├── payments.ts               # PayPal order creation and capture
│       │   ├── ai.ts                     # AI agent routing — LLM prompt dispatch
│       │   └── graph.ts                  # FalkorDB graph queries — market intelligence
│       │
│       ├── services/
│       │   ├── ollama.ts                 # Ollama LLM — DeepSeek + Qwen prompt engineering
│       │   ├── falkordb.ts               # FalkorDB client — Cypher queries for graph reasoning
│       │   ├── supabase.ts               # Supabase client initialization
│       │   └── paypal.ts                 # PayPal REST API — token management, order lifecycle
│       │
│       ├── scripts/
│       │   ├── seed_dataset.ts           # Seeds 200 products + 40 suppliers into Supabase
│       │   ├── seed_payload.json         # Pre-generated seed data (200 products)
│       │   ├── generate_seed_payload.py  # Python script to generate seed data from Excel
│       │   ├── sync_falkordb_catalog.ts  # Syncs product catalog to FalkorDB graph
│       │   ├── wipe_all_data.ts          # Clears all transactional data (keeps products)
│       │   └── inspect_excel.py          # Utility to inspect the source Excel dataset
│       │
│       └── tests/
│           ├── health.test.ts            # Health endpoint contract tests
│           └── api.integration.test.ts   # Full API integration test suite
│
├── public/                               # Static files served by Vite
└── dist/                                 # Production build output
```

---

## Tech Stack

- **Frontend** — React 19, TypeScript, Tailwind CSS 4, Vite 8 — Single-page application with real-time negotiation UI
- **Backend** — Express.js, TypeScript, Node.js — REST API, negotiation engine, agent orchestration
- **Database** — Supabase (PostgreSQL) — Products, suppliers, orders, negotiation messages, user auth
- **Graph DB** — FalkorDB (RedisGraph-compatible) — Historical transaction reasoning, supplier delivery scoring
- **AI Models** — Ollama (local) — DeepSeek-R1:14b, Qwen 2.5:14b — Buyer and seller agent LLMs running entirely on-device
- **Payments** — PayPal Sandbox REST API — Server-side order creation, checkout, and capture
- **Animations** — Framer Motion — Page transitions, micro-interactions, AI thinking orb
- **Validation** — Zod — Runtime schema validation for env config, API contracts
- **Testing** — Vitest + Supertest — Integration and contract tests

---

## Getting Started

### Prerequisites

- **Node.js** v20.x or v22.x (tested on v22.13.0)
- **npm** v10.x+ (comes with Node.js)
- **Ollama** Latest — Required for AI agents — [ollama.com](https://ollama.com)
- **Docker** Latest — Required for FalkorDB
- **Supabase Project** — Free tier works — [supabase.com](https://supabase.com)
- **PayPal Developer Account** — Sandbox credentials — [developer.paypal.com](https://developer.paypal.com)

### 1. Clone the Repository

```bash
git clone https://github.com/Var1035/paypal-ai-procurement.git
cd paypal-ai-procurement
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# FalkorDB (run via Docker)
FALKORDB_HOST=127.0.0.1
FALKORDB_PORT=6379

# PayPal Sandbox
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com

# Ollama (runs locally, no key needed)
```

### 4. Set Up External Services

**Ollama (AI Models):**
```bash
# Install Ollama from https://ollama.com
# Pull the required models
ollama pull deepseek-r1:14b
ollama pull qwen2.5:14b
```

**FalkorDB (Graph Database):**
```bash
docker run -p 6379:6379 -it --rm falkordb/falkordb
```

**Supabase:**
- Create a project at [supabase.com](https://supabase.com)
- The application will auto-create required tables on first run

### 5. Seed the Product Catalog

```bash
cd server
npx tsx src/scripts/seed_dataset.ts
npx tsx src/scripts/sync_falkordb_catalog.ts
cd ..
```

This loads 200 products across 40 supplier companies into both Supabase and FalkorDB.

### 6. Start the Application

```bash
npm run dev
```

This starts both servers concurrently:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:5000

---

## API Reference

### Health

```
GET  /api/health                              → Service status for all connected backends
```

### Products

```
GET  /api/products                            → List all products with optional search/filter
GET  /api/products/:id                        → Get single product details
```

### Suppliers

```
GET  /api/suppliers                           → List all registered suppliers
GET  /api/suppliers/:id                       → Get supplier profile and catalog
```

### Negotiation

```
POST   /api/negotiation/start                 → Start a new multi-round AI negotiation
GET    /api/negotiation/quotations            → List all quotations/RFQs
GET    /api/negotiation/quotations/:id        → Get negotiation details with full transcript
POST   /api/negotiation/quotations/:id/approve       → Buyer approves negotiated terms
POST   /api/negotiation/quotations/:id/seller-approve → Seller approves negotiated terms
POST   /api/negotiation/quotations/:id/counter        → Submit a manual counter-offer
DELETE /api/negotiation/quotations            → Clear all RFQs and associated data
DELETE /api/negotiation/quotations/:id        → Delete a specific quotation
```

### Orders

```
GET   /api/orders                             → List all orders
POST  /api/orders                             → Create order from approved quotation
PATCH /api/orders/:id/status                  → Update order status
```

### Payments

```
POST /api/payments/create-order               → Create PayPal sandbox order
POST /api/payments/capture-order              → Capture payment for a PayPal order
```

### AI

```
POST /api/ai/parse-request                    → Parse natural language into structured procurement
POST /api/ai/chat                             → General AI chat interaction
```

### Graph

```
GET /api/graph/stats                          → FalkorDB graph statistics
GET /api/graph/supplier/:id                   → Supplier's graph relationships and history
```

---

## Negotiation Flow (Detailed)

```
Round 1:  Buyer agent sends opening bid
          Seller agent evaluates and counters
                      │
Round 2:  Buyer adjusts based on seller's counter
          Seller re-evaluates with FalkorDB context
                      │
Round 3+: Continues until...
          • Price convergence (within 5% threshold)
          • Maximum rounds reached (default: 8)
          • One side accepts the other's offer
          • Human intervention (seller takeover)
          • Manual stop by either party
                      │
Agreement:  Both sides approve → PayPal checkout
Stalemate:  No agreement → Negotiation archived
```

### Seller Takeover Flow

```
AI Negotiation Running
        │
Seller clicks "Take Over"
        │
AI agent pauses
        │
Seller types manual responses
(AI learns from seller's approach)
        │
Seller clicks "Hand Over to AI"
        │
AI resumes with updated context
```

---

## Testing

```bash
# Run all backend tests
npm run test

# Run with watch mode (during development)
cd server
npx vitest
```

---

## Scripts Reference

- `npm run dev` — Start frontend + backend concurrently
- `npm run dev:frontend` — Start Vite dev server only
- `npm run dev:server` — Start Express server only
- `npm run build` — Production build (backend + frontend)
- `npm run test` — Run all backend tests
- `npm run lint` — Run oxlint
- `npx tsx server/src/scripts/seed_dataset.ts` — Seed 200 products into Supabase
- `npx tsx server/src/scripts/sync_falkordb_catalog.ts` — Sync catalog to FalkorDB
- `npx tsx server/src/scripts/wipe_all_data.ts` — Clear all transactional data

---

## License

This project was built for the **PayPal AI Hackathon**. All rights reserved.
