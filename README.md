# Assure DeFi Health Checker

Real-time health monitoring and public status page for all Assure DeFi production services.

## Features

- **30 monitors** covering the main site, subdomains, APIs, external services, and SSL certificates
- **Priority-based checking**: P0 (1 min), P1 (2 min), P2 (5 min), P3 (15 min)
- **Multi-channel alerts**: Telegram (P0/P1) + Email via Postmark or SMTP (all priorities)
- **Alert intelligence**: Multi-check confirmation, throttling, maintenance window suppression, recovery notifications
- **SSL certificate monitoring** with 30/14/7-day expiry warnings
- **Public status page** with uptime bars (24h / 7d / 30d / 90d)
- **Incident management** with create, update, and resolve workflows
- **SQLite storage** with 90-day retention and automatic cleanup

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Tailwind CSS v4
- SQLite via better-sqlite3
- Nodemailer for SMTP email
- Postmark for transactional email (optional)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Configuration

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env.local
```

Required environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for alerts | For Telegram alerts |
| `TELEGRAM_CHAT_ID` | Telegram chat/group ID | For Telegram alerts |
| `POSTMARK_API_KEY` | Postmark server token | For Postmark email |
| `ALERT_EMAIL_FROM` | Sender email address | For email alerts |
| `ALERT_EMAIL_TO` | Recipient email address | For email alerts |
| `SMTP_HOST` | SMTP server hostname | For SMTP email (alt) |
| `SMTP_PORT` | SMTP server port | For SMTP email (alt) |
| `SMTP_USER` | SMTP username | For SMTP email (alt) |
| `SMTP_PASS` | SMTP password | For SMTP email (alt) |
| `CRON_SECRET` | Bearer token for cron endpoint | Production |

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the status page.

### Trigger a Manual Check

Click the "Run Check" button in the header, or:

```bash
curl -X POST http://localhost:3000/api/monitors/check
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/monitors` | List all monitors with current status |
| `GET` | `/api/monitors/[id]` | Single monitor detail with history |
| `GET` | `/api/status` | Public status summary by category |
| `POST` | `/api/monitors/check` | Trigger manual check (optional `priority` in body) |
| `GET` | `/api/cron` | Cron-triggered check (use `?priority=P0` query param) |
| `GET` | `/api/incidents` | List all incidents |
| `POST` | `/api/incidents` | Create incident (`{ title, description?, severity?, monitor_id? }`) |
| `GET` | `/api/incidents/[id]` | Get incident detail |
| `PATCH` | `/api/incidents/[id]` | Update incident (`{ status?, description? }`) |

## Monitor Categories

| Category | Count | Priority | Check Type |
|----------|-------|----------|------------|
| Main Site (Worker + Homepage) | 2 | P0 | Keyword |
| Next.js Pages | 4 | P1 | Keyword |
| Webflow Pages | 5 | P1 | HTTP |
| Subdomains | 7 | P0-P1 | HTTP |
| API Endpoints | 4 | P0-P1 | JSON |
| External Services | 2 | P2-P3 | JSON |
| SSL Certificates | 7 | P1 | SSL |

## Deployment

### Vercel

The app includes `vercel.json` with cron configurations for each priority level. Deploy via Vercel and cron jobs will automatically trigger checks at the correct intervals.

### Self-Hosted

Use an external cron service (e.g., crontab, Railway cron) to hit the cron endpoint:

```bash
# P0 checks every minute
* * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain/api/cron?priority=P0

# P1 checks every 2 minutes
*/2 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain/api/cron?priority=P1

# P2 checks every 5 minutes
*/5 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain/api/cron?priority=P2

# P3 checks every 15 minutes
*/15 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain/api/cron?priority=P3
```

## Data Storage

SQLite database is stored at `data/health-checker.db`. The schema is automatically created on first run. Check results are retained for 90 days and automatically cleaned during full cron runs.

## Alert Routing

| Priority | Telegram | Email |
|----------|----------|-------|
| P0 (Critical) | Yes | Yes |
| P1 (High) | Yes | Yes |
| P2 (Medium) | No | Yes |
| P3 (Low) | No | Yes |

Alerts require 2 consecutive failures before triggering (multi-check confirmation). Once triggered, the same alert is throttled for 30 minutes. Recovery notifications are sent when a monitor returns to "up" status.
