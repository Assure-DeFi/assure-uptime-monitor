export interface MonitorConfig {
  id: string;
  name: string;
  url: string;
  category: string;
  priority: "P0" | "P1" | "P2" | "P3";
  check_type: "http" | "keyword" | "ssl" | "json" | "domain_expiry";
  expected_status: number;
  expected_keyword?: string;
  timeout_ms: number;
  interval_seconds: number;
}

const PRIORITY_INTERVALS: Record<string, number> = {
  P0: 60,
  P1: 120,
  P2: 300,
  P3: 900,
};

function m(
  id: string,
  name: string,
  url: string,
  category: string,
  priority: MonitorConfig["priority"],
  overrides?: Partial<MonitorConfig>,
): MonitorConfig {
  return {
    id,
    name,
    url,
    category,
    priority,
    check_type: overrides?.check_type ?? "keyword",
    expected_status: overrides?.expected_status ?? 200,
    expected_keyword: overrides?.expected_keyword,
    timeout_ms: overrides?.timeout_ms ?? 5000,
    interval_seconds:
      overrides?.interval_seconds ?? PRIORITY_INTERVALS[priority],
  };
}

export const MONITORS: MonitorConfig[] = [
  // --- Main Site (Worker + Homepage) — P0 ---
  m(
    "main-worker",
    "Cloudflare Worker",
    "https://assuredefi.com",
    "Main Site",
    "P0",
    {
      expected_keyword: "Assure DeFi",
    },
  ),
  m(
    "main-www",
    "WWW Redirect",
    "https://www.assuredefi.com",
    "Main Site",
    "P0",
    {
      expected_keyword: "Assure DeFi",
    },
  ),

  // --- Next.js Pages — P1 ---
  m(
    "page-pricing",
    "Pricing Page",
    "https://assuredefi.com/pricing",
    "Next.js Pages",
    "P1",
    {
      expected_keyword: "pricing",
    },
  ),
  m(
    "page-projects",
    "Projects Page",
    "https://assuredefi.com/projects",
    "Next.js Pages",
    "P1",
    { expected_keyword: "project" },
  ),
  m(
    "page-checkout",
    "Checkout Page",
    "https://assuredefi.com/checkout",
    "Next.js Pages",
    "P1",
    { expected_keyword: "checkout" },
  ),
  m(
    "page-terms",
    "Terms Page",
    "https://assuredefi.com/terms",
    "Next.js Pages",
    "P1",
    {
      expected_keyword: "terms",
    },
  ),

  // --- Webflow Pages — P1 ---
  m(
    "wf-about",
    "About Page",
    "https://assuredefi.com/about",
    "Webflow Pages",
    "P1",
    {
      check_type: "http",
      timeout_ms: 7000,
    },
  ),
  m(
    "wf-career",
    "Careers Page",
    "https://assuredefi.com/career",
    "Webflow Pages",
    "P1",
    {
      check_type: "http",
      timeout_ms: 7000,
    },
  ),
  m("wf-faq", "FAQ Page", "https://assuredefi.com/faq", "Webflow Pages", "P1", {
    check_type: "http",
    timeout_ms: 7000,
  }),
  m(
    "wf-report",
    "Report a Scam",
    "https://assuredefi.com/report-a-scam",
    "Webflow Pages",
    "P1",
    { check_type: "http", timeout_ms: 7000 },
  ),
  m(
    "wf-download",
    "Downloads Page",
    "https://assuredefi.com/download",
    "Webflow Pages",
    "P1",
    {
      check_type: "http",
      timeout_ms: 7000,
    },
  ),

  // --- Subdomains — P0/P1 ---
  m(
    "sub-app",
    "KYC Portal (Bubble)",
    "https://app.assuredefi.com",
    "Subdomains",
    "P1",
    { check_type: "keyword", expected_keyword: "!maintenance" },
  ),
  m(
    "sub-projects",
    "Projects Directory",
    "https://projects.assuredefi.com",
    "Subdomains",
    "P1",
    { check_type: "keyword", expected_keyword: "project" },
  ),
  m(
    "sub-apis-docs",
    "API Docs",
    "https://apis.assuredefi.com/docs",
    "Subdomains",
    "P1",
    { check_type: "http" },
  ),
  m(
    "sub-network",
    "Assure Network",
    "https://network.assuredefi.com",
    "Subdomains",
    "P1",
    { check_type: "http" },
  ),

  // --- Public API — P1 ---
  m(
    "api-projects",
    "Projects API",
    "https://assuredefi.com/api/projects",
    "API Endpoints",
    "P1",
    { check_type: "json", timeout_ms: 3000, expected_keyword: "[" },
  ),
  m(
    "api-products",
    "Products API",
    "https://assuredefi.com/api/products",
    "API Endpoints",
    "P1",
    { check_type: "json", timeout_ms: 3000, expected_keyword: "[" },
  ),
  m(
    "api-rates",
    "ETH Rates API",
    "https://assuredefi.com/api/rates/eth",
    "API Endpoints",
    "P1",
    { check_type: "json", timeout_ms: 3000, expected_keyword: "rate" },
  ),

  // --- External Services — P2/P3 ---
  m(
    "ext-coingecko",
    "CoinGecko API",
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    "External Services",
    "P2",
    { check_type: "json", timeout_ms: 10000, expected_keyword: "usd" },
  ),
  m(
    "ext-telegram",
    "Telegram Bot API",
    "https://api.telegram.org/bot__TOKEN__/getMe",
    "External Services",
    "P3",
    { check_type: "json", timeout_ms: 10000, expected_keyword: "ok" },
  ),

  // --- SSL & Domain — P1 ---
  m(
    "ssl-main",
    "SSL: assuredefi.com",
    "https://assuredefi.com",
    "SSL & Domain",
    "P1",
    { check_type: "ssl", interval_seconds: 3600 },
  ),
  m(
    "domain-expiry",
    "Domain: assuredefi.com",
    "https://assuredefi.com",
    "SSL & Domain",
    "P1",
    {
      check_type: "domain_expiry",
      interval_seconds: 86400,
    },
  ),
];
