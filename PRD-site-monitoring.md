# PRD: Assure DeFi Site Monitoring

**Status:** Draft
**Date:** 2026-04-14
**Author:** Engineering

---

## 1. Overview

Assure DeFi runs a split-origin website (Cloudflare Worker routing between Vercel and Webflow), multiple subdomains, a checkout/payment system (Stripe + DePay), a KYC fulfillment pipeline (Bubble.io), and supporting services (Supabase, Postmark, Telegram, CoinGecko). An external monitoring service must continuously verify that all production surfaces are up, returning correct content, and responding within acceptable times.

This document defines **what** must be monitored, **what "working" means** for each component, and **what alerts are required**.

---

## 2. Monitoring Targets

### 2.1 Primary Domain — assuredefi.com

#### 2.1.1 Cloudflare Worker (Reverse Proxy)

The Worker is the single point of entry for all traffic. Every request passes through it.

**Requirements:**

- `https://assuredefi.com` returns HTTP 200 with keyword "Assure DeFi" in body
- `https://www.assuredefi.com` redirects or resolves correctly to the canonical domain
- Response time under 3 seconds

**Expected behavior:**

- Returns HTML from the correct backend (Vercel or Webflow) based on path
- Does NOT expose the underlying Vercel deployment URL in any response or redirect

**Edge cases:**

- If Vercel is down but Webflow is up, Vercel-routed pages fail while Webflow pages continue (and vice versa)
- If the Worker itself is down, ALL pages fail — highest-priority monitor

---

#### 2.1.2 Next.js Pages (Served via Vercel)

| Page             | URL                               | Keyword to Verify         |
| ---------------- | --------------------------------- | ------------------------- |
| Homepage         | `https://assuredefi.com/`         | "Assure DeFi"             |
| Pricing          | `https://assuredefi.com/pricing`  | "pricing" or product name |
| Projects listing | `https://assuredefi.com/projects` | project card content      |
| Checkout         | `https://assuredefi.com/checkout` | checkout wizard content   |
| Terms            | `https://assuredefi.com/terms`    | "terms"                   |

**Expected behavior:**

- All return HTTP 200 with expected keyword present
- Pages load within 3 seconds
- No 500 errors under normal conditions

**Edge cases:**

- `/projects/{invalid-slug}` should return 404, not 500
- If Supabase is unreachable, dynamic pages should show a user-facing error, not a blank page or crash

---

#### 2.1.3 Webflow Pages (Passthrough)

| Page          | URL                                    |
| ------------- | -------------------------------------- |
| About         | `https://assuredefi.com/about`         |
| Careers       | `https://assuredefi.com/career`        |
| FAQ           | `https://assuredefi.com/faq`           |
| Report a Scam | `https://assuredefi.com/report-a-scam` |
| Downloads     | `https://assuredefi.com/download`      |

**Requirements:**

- Each returns HTTP 200
- Content loads within 5 seconds

**Edge cases:**

- If Webflow is down, these pages fail but Next.js pages should continue working
- Webflow may return 429 (rate limit) — should be flagged

---

### 2.2 Subdomains

#### 2.2.1 checkout.assuredefi.com

Embeddable checkout widget used by partner integrations.

**Requirements:**

- `https://checkout.assuredefi.com/embed` returns HTTP 200
- `https://checkout.assuredefi.com/widget/v1/assure-checkout.js` returns HTTP 200

**Expected behavior:**

- Embed page loads the checkout wizard
- Widget JS is served via CDN

**Edge cases:**

- If the widget JS is unreachable, ALL partner-embedded checkouts break — high priority
- CORS headers must be present for cross-origin iframe embedding

---

#### 2.2.2 app.assuredefi.com (Bubble.io — KYC Portal)

**Requirements:**

- `https://app.assuredefi.com` returns HTTP 200
- Keyword check: should NOT contain "maintenance" or Bubble error page content

**Expected behavior:**

- KYC verification dashboard loads for authenticated users

**Edge cases:**

- Bubble.io platform outages take this down entirely — no local fallback
- Bubble may return HTTP 200 with a maintenance/error page — keyword monitoring is needed to catch this

---

#### 2.2.3 projects.assuredefi.com (Verified Projects Directory)

Linked from the main site header, footer, and hero section.

**Requirements:**

- `https://projects.assuredefi.com` returns HTTP 200
- Page contains verified project listings

**Edge cases:**

- This is a separate deployment from the main site — it can go down independently
- If this is down, links throughout the main site lead to errors

---

#### 2.2.4 apis.assuredefi.com (Public API + Docs)

Linked from the main site header. Provides public API access and documentation.

**Requirements:**

- `https://apis.assuredefi.com` returns HTTP 200
- `https://apis.assuredefi.com/docs` returns HTTP 200

**Edge cases:**

- Used by external integrators — downtime affects third-party applications

---

#### 2.2.5 network.assuredefi.com (Assure Network)

Separate product site ("transforming ideas into digital realities").

**Requirements:**

- `https://network.assuredefi.com` returns HTTP 200

---

### 2.3 API Endpoints

#### 2.3.1 Public API (GET — directly monitorable)

| Endpoint         | Expected Response               |
| ---------------- | ------------------------------- |
| `/api/projects`  | HTTP 200 + JSON array           |
| `/api/products`  | HTTP 200 + JSON array           |
| `/api/rates/eth` | HTTP 200 + JSON with rate value |

**Requirements:**

- All return HTTP 200 with valid JSON
- Response time under 2 seconds

**Edge cases:**

- `/api/rates/eth` may return a cached fallback rate if CoinGecko is down — acceptable short-term, but stale rates beyond 10 minutes are a problem
- `/api/projects` returning `[]` unexpectedly may indicate Supabase is down

---

#### 2.3.2 Payment & Checkout API (POST — not directly monitorable)

These endpoints require valid POST bodies and cannot be monitored with simple HTTP checks:

- `/api/checkout/sessions`
- `/api/payments/calculate`
- `/api/payments/stripe`
- `/api/payments/depay/config`
- `/api/payments/depay/route`

**Requirements:**

- Invalid requests should return 400 (bad request), not 500 (server error)
- The `/api/health` endpoint (Section 2.5) validates the underlying payment stack

**Edge cases:**

- If Stripe SDK fails to initialize, all fiat payments fail silently
- If DePay signing key is invalid, crypto checkout widget won't load
- If Supabase is down, order creation fails

---

#### 2.3.3 Webhook Endpoints

| Endpoint                                | Source    |
| --------------------------------------- | --------- |
| `/api/webhooks/stripe`                  | Stripe    |
| `/api/webhooks/depay`                   | DePay     |
| `/api/webhooks/bubble/project-verified` | Bubble.io |

**Requirements:**

- Endpoints must be reachable and not returning 500
- Webhook failures should be detectable within 5 minutes

**Edge cases:**

- A 500 response causes payment providers to retry, potentially creating duplicate orders
- If a webhook endpoint is down for >1 hour, payment confirmation and fulfillment are blocked

---

### 2.4 Health Check Endpoint (Required — Does Not Exist Yet)

A dedicated endpoint to enable deep monitoring beyond simple HTTP checks.

**Requirements:**

- `GET /api/health` returns HTTP 200 when healthy, HTTP 503 when degraded
- Validates critical dependencies: database (Supabase), payment providers (Stripe init, DePay signing key), email (Postmark)
- Response time under 5 seconds
- Excluded from authentication middleware

**Expected response:**

```json
{
  "status": "healthy | degraded | unhealthy",
  "timestamp": "ISO-8601",
  "checks": {
    "database": { "status": "up | down", "latency_ms": 45 },
    "stripe": { "status": "up | down" },
    "depay_signing": { "status": "up | down" },
    "email": { "status": "up | down" }
  }
}
```

**Edge cases:**

- Must not expose sensitive information (no keys, no connection strings)
- Each dependency check must have its own timeout (3s) to prevent the whole endpoint from hanging

---

### 2.5 External Service Dependencies

These are not owned by Assure DeFi but directly impact functionality. Monitor their public status endpoints or use the `/api/health` endpoint as an indirect check.

| Service       | Impact                                       | What to Monitor                                                                                 |
| ------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Supabase**  | Critical — all dynamic content, auth, orders | Monitored indirectly via `/api/health` and `/api/projects`                                      |
| **Stripe**    | Critical — fiat payments blocked if down     | `https://status.stripe.com` (subscribe to updates)                                              |
| **DePay**     | Critical — crypto payments blocked if down   | Monitored indirectly via `/api/health` (signing key check)                                      |
| **CoinGecko** | Medium — falls back to hardcoded rates       | `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd` returns HTTP 200 |
| **Postmark**  | Medium — email delivery delayed              | Monitored indirectly via `/api/health`                                                          |
| **Telegram**  | Low — admin notifications delayed only       | `https://api.telegram.org/bot{token}/getMe` returns HTTP 200                                    |

**Edge cases:**

- CoinGecko has aggressive free-tier rate limiting — monitoring it too frequently may itself trigger rate limits
- Stripe/DePay outages are best detected via their own status pages + the `/api/health` check, not by hitting their APIs directly

---

### 2.6 SSL Certificates

SSL must be monitored for expiry on all production domains:

- `assuredefi.com`
- `www.assuredefi.com`
- `checkout.assuredefi.com`
- `app.assuredefi.com`
- `projects.assuredefi.com`
- `apis.assuredefi.com`
- `network.assuredefi.com`

**Requirements:**

- Alert at 30, 14, and 7 days before expiry
- Immediate alert on certificate errors (expired, invalid, revoked, mismatched)

---

## 3. Alerting Requirements

### 3.1 Alert Priority Levels

| Priority      | Response Time     | Channels         | Examples                                                                         |
| ------------- | ----------------- | ---------------- | -------------------------------------------------------------------------------- |
| P0 — Critical | Immediate         | Telegram + Email | Main site down, Worker down, all payments failing                                |
| P1 — High     | Within 5 min      | Telegram + Email | Single payment provider down, Supabase unreachable, subdomain down, SSL < 7 days |
| P2 — Medium   | Within 30 min     | Email            | CoinGecko down, Postmark down, Webflow pages down                                |
| P3 — Low      | Next business day | Email            | Response time degradation, Telegram bot unreachable                              |

### 3.2 Alert Conditions

**Downtime:**

- Trigger only after confirmed downtime (multi-location verification to prevent false positives)
- Include recovery notification when service comes back up

**Response time:**

- Alert when response time exceeds threshold for 3+ consecutive checks
- Thresholds: 3s for pages, 2s for APIs, 5s for health check

**SSL:**

- 30/14/7/0-day expiry warnings
- Immediate alert on certificate errors

**Content (keyword monitoring):**

- Alert if expected keyword is missing from critical pages (e.g., "Assure DeFi" missing from homepage = possible deployment failure)
- Alert if error content appears ("Internal Server Error", "Application Error")

### 3.3 Alert Suppression

- Maintenance windows suppress alerts during planned downtime
- Repeated alerts for the same incident are throttled
- Alerts auto-resolve when the issue clears

---

## 4. Status Page

A public status page for customers and partners.

**Requirements:**

- Accessible at a dedicated URL (e.g., `status.assuredefi.com`)
- Displays current status of: main website, checkout system, KYC portal, API, projects directory
- Shows uptime percentage for 24h / 7d / 30d / 90d
- Incident history with timestamps and resolution notes
- Manual incident announcements for planned maintenance
- Hosted independently from the main site — must be accessible even when the main site is down

---

## 5. Monitor Inventory Summary

| Category                                            | Monitors | Priority |
| --------------------------------------------------- | -------- | -------- |
| Main site (Worker + homepage)                       | 2        | P0       |
| Next.js pages                                       | 4        | P1       |
| Webflow pages                                       | 5        | P1       |
| Subdomains (checkout, app, projects, apis, network) | 6        | P0–P1    |
| Health check endpoint                               | 1        | P0       |
| Public API endpoints                                | 3        | P1       |
| External services (CoinGecko, Telegram)             | 2        | P2–P3    |
| SSL certificates                                    | 7        | P1       |
| **Total**                                           | **~30**  |          |

Note: Stripe, DePay, Supabase, and Postmark are monitored indirectly via the `/api/health` endpoint rather than as separate monitors. SSL monitoring is typically automatic on HTTP monitors.

---

## 6. Success Criteria

The monitoring system is fully operational when:

1. All ~30 monitors are active and reporting
2. P0 alerts reach Telegram + email within 1 minute of confirmed downtime
3. A public status page is live at `status.assuredefi.com`
4. `/api/health` endpoint exists and validates all critical dependencies
5. SSL expiry alerts fire at 30/14/7 days
6. Recovery alerts fire within 2 minutes of restoration
7. False positive rate is below 5% over first 2 weeks
8. At least one simulated failure test has been run per monitor category
