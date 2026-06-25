# INVENTORY-VIS (INVIOLÁVEL WMS)

A high-end, responsive inventory management and WMS control system built with a **Node.js (TypeScript/Express/PostgreSQL) Backend** and a **React (TypeScript/Vite) Frontend**.

---

## ⚡ Key Features

1. **Analytical Dashboard:** Real-time metrics tracking total inventory valuation, aggregate physical unit count, low stock warnings, and unique active SKUs.
2. **Visual Analytics & Charts:** Embedded interactive charts using Recharts:
    *   *Category Distribution:* PieChart illustrating total asset value distribution.
    *   *Product Comparison:* BarChart comparing SKU units against asset valuation in USD.
3. **WMS Movement Auditing:**
    *   Record physical movements (`ENTRADA` or `SAIDA`) with dedicated subtypes (`NEGOCIACAO_VENDA`, `BONIFICACAO`, `TRANSFERENCIA`, etc.).
    *   Dedicated **Audit History Log** tracking WMS movements chronologically.
4. **PostgreSQL Concurrency Control:**
    *   Utilizes raw Postgres triggers (`tg_processar_movimentacao` and `tg_recalcular_planejamento`).
    *   Implements **row-level locking** (`SELECT ... FOR UPDATE`) in database transaction triggers to completely mitigate double-selling race conditions on concurrent API sales!
5. **Backorder Tolerance Rules:**
    *   Products under categories like `Accessories` permit negative stocks (*backorders*). Other categories enforce strict positive stock checks and abort transactions on insufficient stock.
6. **Gemini AI Insights:** Collapsible panel powered by `gemini-1.5-flash` API delivering executive reviews, valuation risks, and automated purchase quantities planning.
7. **Offline Redundancy Fallback:** Automatically switches data operations to `localStorage` if backend servers are down, keeping the UI fully operational with a visual "Offline" alert.

---

## 📂 Project Structure

```
INVENTORY-VIS/
├── docker-compose.yml        # PostgreSQL alpine database container
├── backend/                  # Node.js (TypeScript) Express API
│   ├── src/
│   │   ├── index.ts          # Express server endpoints
│   │   ├── postgresDb.ts     # PostgreSQL pool adapter, schemas, indices, and triggers
│   │   └── mockData.ts       # Fallback seeds and interfaces
│   ├── tsconfig.json         # Backend TS configuration
│   └── package.json          # Node dependencies (pg, @google/generative-ai)
│
└── frontend/                 # React (TypeScript) Vite App
    ├── src/
    │   ├── main.tsx          # React bootloader
    │   ├── App.tsx           # Dashboard UI, WMS forms, Recharts charts, and Fallback triggers
    │   ├── App.css           # Local reset css
    │   └── index.css         # Visual design system (Sleek/Cold Luxury)
    └── package.json          # React dependencies (recharts, @phosphor-icons/react)
```

---

## 🚀 Setup & Execution

### 1. Prerequisites
Ensure you have **Node.js** (v18+), **npm**, and **Docker** installed.

---

### 2. Booting the Database Container

Start the PostgreSQL database service at the project root:
```bash
docker compose up -d
```
The database will be hosted on `localhost:5432` mapped with standard credentials:
*   **User:** `inviolavel_user`
*   **Password:** `inviolavel_password`
*   **Database:** `inviolavel_wms`

---

### 3. Running the Backend Server

```bash
cd backend
npm install
npm run dev
```
The backend initializes the schemas, SQL enums, indices, and PostgreSQL triggers automatically on startup and binds to [http://localhost:3001](http://localhost:3001).

---

### 4. Running the Frontend Dashboard

In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
