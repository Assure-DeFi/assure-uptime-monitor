/**
 * OpenRouter API client — backend only.
 *
 * Uses the Management API key to list all keys and check credit usage.
 * Management keys CANNOT make LLM calls — they only read/manage keys.
 * NEVER import this file from any client component or API route exposed to the internet.
 */

import { z } from "zod";

const OpenRouterKeySchema = z.object({
  hash: z.string(),
  name: z.string(),
  label: z.string(),
  disabled: z.boolean(),
  limit: z.number().nullable(),
  limit_remaining: z.number().nullable(),
  limit_reset: z.enum(["daily", "weekly", "monthly"]).nullable(),
  include_byok_in_limit: z.boolean(),
  usage: z.number(),
  usage_daily: z.number(),
  usage_weekly: z.number(),
  usage_monthly: z.number(),
  byok_usage: z.number(),
  byok_usage_daily: z.number(),
  byok_usage_weekly: z.number(),
  byok_usage_monthly: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  creator_user_id: z.string().nullable(),
  workspace_id: z.string(),
});

const ListKeysResponseSchema = z.object({
  data: z.array(OpenRouterKeySchema),
});

type OpenRouterKey = z.infer<typeof OpenRouterKeySchema>;

export interface KeyUsageResult {
  name: string;
  label: string;
  periodUsage: number;
  limit: number | null;
  remaining: number | null;
  limitReset: string | null;
  percentUsed: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
  error: string | null;
}

const OPENROUTER_KEYS_URL = "https://openrouter.ai/api/v1/keys";
const NEAR_LIMIT_THRESHOLD = 0.8;

function getPeriodUsage(key: OpenRouterKey): number {
  switch (key.limit_reset) {
    case "daily":
      return key.usage_daily;
    case "weekly":
      return key.usage_weekly;
    case "monthly":
      return key.usage_monthly;
    default:
      return key.usage;
  }
}

function evaluateKey(key: OpenRouterKey): KeyUsageResult {
  const limit = key.limit;
  const remaining = key.limit_remaining;
  const periodUsage = getPeriodUsage(key);

  let percentUsed = 0;
  let isOverLimit = false;
  let isNearLimit = false;

  if (limit !== null && limit > 0) {
    percentUsed = periodUsage / limit;
    isNearLimit = percentUsed >= NEAR_LIMIT_THRESHOLD;
    isOverLimit = remaining !== null ? remaining <= 0 : periodUsage >= limit;
  }

  return {
    name: key.name || key.label || key.hash.slice(0, 8),
    label: key.label || "",
    periodUsage,
    limit,
    remaining,
    limitReset: key.limit_reset,
    percentUsed,
    isOverLimit,
    isNearLimit,
    error: null,
  };
}

function makeErrorResult(error: string): KeyUsageResult {
  return {
    name: "API",
    label: "",
    periodUsage: 0,
    limit: null,
    remaining: null,
    limitReset: null,
    percentUsed: 0,
    isOverLimit: false,
    isNearLimit: false,
    error,
  };
}

export async function checkAllKeys(): Promise<KeyUsageResult[]> {
  const managementKey = process.env.OPENROUTER_MANAGEMENT_KEY;
  if (!managementKey) return [];

  try {
    const response = await fetch(OPENROUTER_KEYS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${managementKey}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const status = response.status;
      console.error(`[openrouter-client] List keys failed: HTTP ${status}`);
      return [makeErrorResult(`Management API returned HTTP ${status}`)];
    }

    const raw: unknown = await response.json();
    const parsed = ListKeysResponseSchema.safeParse(raw);

    if (!parsed.success) {
      console.error(
        "[openrouter-client] Response validation failed:",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      );
      return [makeErrorResult("API response did not match expected schema")];
    }

    const activeKeys = parsed.data.data.filter((k) => !k.disabled);
    return activeKeys.map(evaluateKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[openrouter-client] Failed to check keys:", message);
    return [makeErrorResult(message)];
  }
}

export function isConfigured(): boolean {
  return !!process.env.OPENROUTER_MANAGEMENT_KEY;
}
