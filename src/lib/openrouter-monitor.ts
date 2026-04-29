/**
 * OpenRouter credit limit monitor — backend only.
 *
 * Periodically checks all configured OpenRouter API keys for credit usage.
 * Sends Telegram alerts when keys are near or over their daily limit.
 * This module has NO public API routes and is NEVER exposed to the frontend.
 */

import { checkAllKeys, isConfigured } from "./openrouter-client";

const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between repeat alerts per key
const lastAlertTimes = new Map<string, number>();

function shouldAlert(keyName: string): boolean {
  const lastAlert = lastAlertTimes.get(keyName);
  if (!lastAlert) return true;
  return Date.now() - lastAlert >= ALERT_COOLDOWN_MS;
}

function recordAlert(keyName: string): void {
  lastAlertTimes.set(keyName, Date.now());
}

async function sendTelegramMessage(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn(
      "[openrouter-monitor] Telegram credentials not configured, skipping alert",
    );
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(
      `[openrouter-monitor] Telegram API error: ${response.status} ${body}`,
    );
  }
}

export async function runOpenRouterCreditCheck(): Promise<void> {
  if (!isConfigured()) {
    return;
  }

  console.log(
    "[openrouter-monitor] Checking OpenRouter API key credit usage...",
  );

  const results = await checkAllKeys();

  for (const result of results) {
    if (result.error) {
      console.warn(
        `[openrouter-monitor] Error checking key "${result.name}": ${result.error}`,
      );
      if (shouldAlert(result.name + ":error")) {
        await sendTelegramMessage(
          `⚠️ <b>OpenRouter Monitor Error</b>\n\nKey: <b>${result.name}</b>\nError: ${result.error}\n\nCould not check credit usage.`,
        );
        recordAlert(result.name + ":error");
      }
      continue;
    }

    if (result.isOverLimit) {
      if (shouldAlert(result.name + ":over")) {
        const resetLabel = result.limitReset ?? "total";
        await sendTelegramMessage(
          `🚨 <b>OpenRouter Credit Limit EXCEEDED</b>\n\nKey: <b>${result.name}</b>\n${resetLabel} usage: $${result.periodUsage.toFixed(2)} / $${(result.limit ?? 0).toFixed(2)}\nStatus: <b>OVER LIMIT</b>\n\nThis key has exhausted its ${resetLabel} credit limit. API calls will fail.`,
        );
        recordAlert(result.name + ":over");
      }
    } else if (result.isNearLimit) {
      if (shouldAlert(result.name + ":near")) {
        const resetLabel = result.limitReset ?? "total";
        await sendTelegramMessage(
          `⚠️ <b>OpenRouter Credit Warning</b>\n\nKey: <b>${result.name}</b>\n${resetLabel} usage: $${result.periodUsage.toFixed(2)} / $${(result.limit ?? 0).toFixed(2)} (${Math.round(result.percentUsed * 100)}%)\nRemaining: $${(result.remaining ?? 0).toFixed(2)}\n\nApproaching ${resetLabel} credit limit (>80%).`,
        );
        recordAlert(result.name + ":near");
      }
    }
  }

  const checkedCount = results.length;
  const alertCount = results.filter(
    (r) => r.isOverLimit || r.isNearLimit,
  ).length;
  console.log(
    `[openrouter-monitor] Checked ${checkedCount} keys. ${alertCount} at/near limit.`,
  );
}
