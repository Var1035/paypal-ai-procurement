# AgentMarket — AI-Powered B2B Procurement Marketplace

**PayPal AI Hackathon | Implementation Specification**

AgentMarket connects a buyer's AI agent with independent, business-controlled supplier AI agents to automate discovery, RFQ dispatch, bounded negotiation, two-sided human approvals, and PayPal Sandbox payments, anchored by **FalkorDB** graph-based historical reasoning and **Supabase** transactional records.

---

## Architecture Overview

```text
PAYPAL AI/
├── shared/                   # Shared TypeScript contracts and Zod validation schemas
│   ├── contracts.ts          # Health, error, and domain data contracts
│   └── index.ts              # Canonical export
├── server/                   # Node.js + TypeScript + Express Orchestration Backend
│   ├── src/
│   │   ├── config/env.ts     # Zod-validated environment config & service status
│   │   ├── middleware/       # Centralized error handler & security middleware
│   │   ├── routes/health.ts  # Health-check endpoint
│   │   ├── app.ts            # Express application definition
│   │   ├── index.ts          # Server entrypoint
│   │   └── tests/            # Vitest integration and contract tests
│   ├── package.json          # Server dependencies & scripts
│   └── tsconfig.json         # NodeNext TypeScript configuration
├── src/                      # React 19 + TypeScript + Vite + Tailwind CSS Frontend
│   ├── components/ui/        # Modern UI components & interactive explainer
│   ├── services/apiClient.ts # Typed frontend API client with contract enforcement
│   └── App.tsx               # Root application view
├── .env.example              # Documented environment variable template
├── package.json              # Root project scripts (concurrent execution)
└── abstract.txt              # Primary project and technical specification
```

---

## Getting Started

### Prerequisites
* **Node.js**: `v20.x` or `v22.x` (tested on Node `v22.13.0`)
* **npm**: `v10.x`+

### 1. Installation

Install dependencies for both the root workspace and the backend server:

```bash
# Install root (frontend + tooling) dependencies
npm install

# Install backend server dependencies
cd server
npm install
cd ..
```

### 2. Environment Configuration

Copy the `.env.example` file to create your local `.env`:

```bash
cp .env.example .env
```

Review and populate variables as external services become configured:
* `PORT`: Server port (default: `5000`)
* `NODE_ENV`: Runtime environment (`development` / `production`)
* `CLIENT_URL`: Allowed frontend origin (`http://localhost:5173`)
* `SUPABASE_URL` / `SUPABASE_ANON_KEY`: Supabase project credentials
* `FALKORDB_HOST` / `FALKORDB_PORT`: FalkorDB connection parameters
* `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`: PayPal Sandbox developer credentials
* `GEMINI_API_KEY`: Google Gemini API key

*(Note: During Phase 1 Foundation, external credentials are optional. The backend evaluates their readiness transparently without fabricating dummy success.)*

---

## Running the Application

### Development Mode (Frontend + Backend concurrently)
Runs both the Vite development server (port 5173) and the Express backend (port 5000) simultaneously:

```bash
npm run dev
```

### Running Components Individually
* **Frontend only**: `npm run dev:frontend` (serves on `http://localhost:5173`)
* **Backend only**: `npm run dev:server` (serves on `http://localhost:5000`)

---

## Testing & Quality Checks

Run the automated test suite verifying health endpoints, 404 handlers, and contract schemas:

```bash
npm run test
```

Build both the backend and frontend for production verification:

```bash
npm run build
```

---

## API Endpoints (Phase 1)

### `GET /api/health`
Returns the operational health of the orchestration server and honest status of connected external services.

**Sample Response (`200 OK`):**
```json
{
  "status": "ok",
  "service": "agentmarket-orchestrator",
  "version": "1.0.0",
  "timestamp": "2026-10-12T10:22:00.000Z",
  "environment": "development",
  "services": {
    "supabase": {
      "configured": false,
      "status": "missing_credentials",
      "details": "Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment"
    },
    "falkordb": {
      "configured": false,
      "status": "missing_credentials",
      "details": "Missing FALKORDB_HOST in environment"
    },
    "paypal": {
      "configured": false,
      "status": "missing_credentials",
      "details": "Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in environment"
    },
    "gemini": {
      "configured": false,
      "status": "missing_credentials",
      "details": "Missing GEMINI_API_KEY in environment"
    }
  }
}
```

---

## Implementation Roadmap

- [x] **Phase 1: Foundation** — Dual-service architecture, shared contracts, environment validation, health check endpoint, frontend API client, and integration tests.
- [ ] **Phase 2: Procurement & Supplier Agents** — Structured RFQ intake, Supabase catalog migrations, and 3 independent supplier agents (`DeskWorks`, `FurnitureHub`, `ClassRoom Supply Co.`).
- [ ] **Phase 3: FalkorDB Graph Reasoning** — Graph schema, Cypher seeding, and evidence-backed supplier rankings.
- [ ] **Phase 4: Agent Negotiation** — Bounded 3-round multi-agent loop, deterministic policy validator, and audit trail.
- [ ] **Phase 5: Human Approvals & PayPal Sandbox** — Two-sided approvals and server-side PayPal order creation & capture.
- [ ] **Phase 6: Fulfillment & End-to-End Verification** — Order lifecycle, tracking events, and verified demo flow.
