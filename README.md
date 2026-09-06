# Network Pulse 🌐⚡

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?style=flat&logo=sqlite)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Network Pulse** is an enterprise-grade, real-time network quality, latency, and packet loss monitoring dashboard. Built with a sleek Apple-inspired frosted-glass aesthetic (Bento Grid layout), it visualizes network telemetry across major Chinese telecommunications carriers (China Telecom, China Unicom, China Mobile, and CERNET) with interactive 3D geospatial heatmaps and temporal trend analysis.

---

## ✨ Features

- 🗺️ **Interactive Geospatial Heatmap**:
  - SVG/GeoJSON-based provincial map of China with real-time color-coded latency tiers.
  - Multi-carrier filtering (All, Telecom, Unicom, Mobile, CERNET).
  - Click-to-drilldown regional history modal with batch logs, probe metrics, and ASN distribution.

- 📈 **Time-Series Analysis & Trends**:
  - High-performance ECharts-powered timeline graphs (24 Hours, 7 Days, 30 Days).
  - Tracks composite national latency, packet loss percentage, and extreme value ranges.
  - Seamless localization and dark/light mode responsive transitions.

- 🛰️ **Dual-Source Multi-Provider Dispatcher**:
  - **Globalping Community Network**: Access to 50+ geographically distributed Chinese backbone probes.
  - **Custom REST API**: Support for proprietary or internal test nodes and enterprise telemetry endpoints.
  - **Hybrid Mode**: Concurrent multi-path dispatching with intelligent deduplication and automatic province replenishment.

- 🏙️ **Guaranteed Hubs & Quota Rotation**:
  - **12 Guaranteed Core Hubs**: 100% persistent coverage across strategic geographical centers (Beijing, Shanghai, Guangzhou, Chengdu, Chongqing, Wuhan, etc.).
  - **34 Candidate City Pool**: Fair, non-preemptive sampling without repetition per cycle.
  - **Precise Credit-Saving Mode**: Zero credit waste with strict node limits.

- ⚙️ **Cascade Quality Tier Rule Engine**:
  - Top-to-bottom rule prioritization chain with `AND` criteria evaluation (Max Latency + Max Loss).
  - Integrated custom HEX palette picker.
  - Real-time simulation sandbox with instant execution tracing.

- 🛡️ **Comprehensive Admin Console (`/admin`)**:
  - Protected with local salted encryption password authentication.
  - Unified configuration for scheduling, probe counts, natural clock alignment (00:00, 00:05...), and custom endpoints.
  - Built-in SQLite maintenance: Automated daily downsampling (Data Rollup), batch log cleanup, and one-click `VACUUM` space reclamation.

- 🌐 **Full Multi-Language Support (i18n)**:
  - 🇨🇳 **简体中文** (Simplified Chinese)
  - 🇺🇸 **English**
  - 🇯🇵 **日本語** (Japanese)
  - 🇰🇷 **한국어** (Korean)
  - Zero-dependency, type-safe proxy architecture with instant runtime switching and browser preference detection.

- 🌓 **Adaptive Apple-Style UI**:
  - Fluid light and dark modes with glassmorphism backdrop blurs.
  - Fully responsive for mobile, tablet, and desktop screens with zero text truncation or layout overflows.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict type checking)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), Radix UI Primitives, Lucide Icons
- **Data Visualization**: [Apache ECharts](https://echarts.apache.org/) (`echarts-for-react`)
- **Database**: [libSQL / SQLite](https://github.com/tursodatabase/libsql-client-ts) (Zero external database dependency)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand), NiceModal
- **Probe Network**: [Globalping API](https://globalping.io/) + Custom HTTP Probe Protocol

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18.18.0 or later
- [pnpm](https://pnpm.io/) (recommended) or npm / yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/aquamarine-z/network-speedtest.git
   cd network-speedtest
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Configure Environment Variables (Optional)**:
   Create a `.env.local` file in the project root:
   ```env
   # Default target to monitor
   DEFAULT_TARGET_NODE=speed.cloudflare.com

   # Default admin password (default: admin123)
   ADMIN_PASSWORD=your_secure_password

   # Cron Secret for external scheduling trigger (optional)
   CRON_SECRET=your_cron_secret
   ```

4. **Run the Development Server**:
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

5. **Open the Application**:
   - Main Dashboard: [http://localhost:3000](http://localhost:3000)
   - Admin Console: [http://localhost:3000/admin](http://localhost:3000/admin) *(Default password: `admin123`)*

---

## 📦 Production Deployment

### Build

```bash
pnpm build
# or
npm run build
```

### Start

```bash
pnpm start
# or
npm run start
```

### Docker Deployment (GitHub Packages / GHCR)

You can run the official pre-built multi-arch image directly from GitHub Container Registry:

```bash
docker run -d \
  --name network-pulse \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e DEFAULT_TARGET_NODE=speed.cloudflare.com \
  -e ADMIN_PASSWORD=admin123 \
  ghcr.io/aquamarine-z/network-speedtest:latest
```

### Docker Compose

A preconfigured [docker-compose.yml](file:///l:/TypeScript%20Projects/network-speedtest/docker-compose.yml) is included in the root directory:

```bash
# Start container in background
docker compose up -d

# Or build locally from source
docker compose up -d --build
```

### Running with PM2 (Node Server)

To deploy as a long-running service with automated background inspections:

```bash
npm install -g pm2
pm2 start npm --name "network-pulse" -- run start
```


---

## 📡 Custom Probe Protocol

If you operate your own speedtest nodes or proprietary servers, Network Pulse can query them directly.

### Request Format
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <TOKEN>` *(Optional)*
- **Body**:
  ```json
  {
    "target": "speed.cloudflare.com",
    "packets": 3
  }
  ```

### Response Format
```json
{
  "probes": [
    {
      "city": "Hangzhou",
      "province": "Zhejiang",
      "carrier": "China Telecom",
      "asn": 4134,
      "avgLatency": 23.5,
      "minLatency": 21.0,
      "maxLatency": 25.8,
      "lossRate": 0
    }
  ]
}
```

---

## 📁 Project Structure

```text
├── app/
│   ├── admin/             # Admin management console
│   ├── api/               # Serverless API routes (measure, cron, history, config)
│   ├── globals.css        # Global CSS & Apple design system styling
│   ├── layout.tsx         # Root layout with Providers
│   └── page.tsx           # Main dashboard entrypoint
├── components/
│   ├── ui/                # Base UI components (Radix + Tailwind)
│   ├── LanguageSwitcher.tsx  # Dynamic multi-language selector
│   ├── LatencyTrendChart.tsx # Historical timeline ECharts graph
│   ├── Navbar.tsx            # Sticky frosted navigation bar
│   ├── NetworkHeroOverview.tsx # Bento metric summary cards
│   ├── Providers.tsx         # Theme & Locale context provider
│   ├── QualityTiersEditor.tsx# Rule engine configuration modal
│   ├── RealChinaMap.tsx      # Interactive 3D SVG China heatmap
│   ├── RegionHistoryPopover.tsx # Regional drilldown detail panel
│   └── RegionLatencyChart.tsx   # Per-province historical inspection chart
├── data/                  # SQLite storage directory (.gitkeep tracked)
├── lib/
│   ├── carrier.ts         # Carrier color palettes & ASN mapping
│   ├── city-metadata.ts   # Core hub quotas and coordinate records
│   ├── db.ts              # SQLite database schema, migrations & queries
│   ├── globalping.ts      # Globalping REST client
│   ├── providers/         # Multi-provider dispatch abstractions
│   └── quality-tiers.ts   # Default network quality criteria
├── locales/               # Strictly-typed i18n dictionaries
│   ├── zh-CN.ts           # Simplified Chinese
│   ├── en-US.ts           # English
│   ├── ja-JP.ts           # Japanese
│   ├── ko-KR.ts           # Korean
│   └── index.ts           # Global i18n proxy & export
└── public/
    └── data/china.json    # High-precision China GeoJSON map data
```

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
