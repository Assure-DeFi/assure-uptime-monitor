import nodemailer from "nodemailer";
import { logAlert } from "./db";

interface AlertChannels {
  telegram: boolean;
  email: boolean;
}

function getChannelsForPriority(priority: string): AlertChannels {
  switch (priority) {
    case "P0":
    case "P1":
      return { telegram: true, email: true };
    case "P2":
      return { telegram: false, email: true };
    case "P3":
      return { telegram: false, email: true };
    default:
      return { telegram: false, email: true };
  }
}

export async function sendAlerts(
  priority: string,
  alertType: string,
  message: string,
  monitorId: string,
): Promise<void> {
  const channels = getChannelsForPriority(priority);

  const promises: Promise<void>[] = [];

  if (channels.telegram) {
    promises.push(
      sendTelegramAlert(message, monitorId, alertType).catch((err) => {
        console.error("Telegram alert failed:", err);
      }),
    );
  }

  if (channels.email) {
    promises.push(
      sendEmailAlert(message, priority, monitorId, alertType).catch((err) => {
        console.error("Email alert failed:", err);
      }),
    );
  }

  await Promise.allSettled(promises);
}

async function sendTelegramAlert(
  message: string,
  monitorId: string,
  alertType: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("Telegram credentials not configured, skipping alert");
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
    throw new Error(`Telegram API error: ${response.status} ${body}`);
  }

  logAlert(monitorId, alertType, "telegram", message);
}

async function sendEmailAlert(
  message: string,
  priority: string,
  monitorId: string,
  alertType: string,
): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const emailFrom = process.env.ALERT_EMAIL_FROM;
  const emailTo = process.env.ALERT_EMAIL_TO;

  // Also support Postmark via SMTP
  const postmarkToken = process.env.POSTMARK_API_KEY;

  if (postmarkToken && emailFrom && emailTo) {
    await sendPostmarkEmail(
      postmarkToken,
      emailFrom,
      emailTo,
      priority,
      message,
      monitorId,
      alertType,
    );
    return;
  }

  if (!smtpHost || !smtpUser || !smtpPass || !emailFrom || !emailTo) {
    console.warn("Email credentials not configured, skipping alert");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const subject = `[${priority}] Assure DeFi Health Alert: ${alertType === "recovery" ? "RECOVERED" : alertType.toUpperCase()}`;

  await transporter.sendMail({
    from: emailFrom,
    to: emailTo,
    subject,
    text: message,
  });

  logAlert(monitorId, alertType, "email", message);
}

async function sendPostmarkEmail(
  apiToken: string,
  from: string,
  to: string,
  priority: string,
  message: string,
  monitorId: string,
  alertType: string,
): Promise<void> {
  const subject = `[${priority}] Assure DeFi Health Alert: ${alertType === "recovery" ? "RECOVERED" : alertType.toUpperCase()}`;

  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": apiToken,
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: subject,
      TextBody: message,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Postmark API error: ${response.status} ${body}`);
  }

  logAlert(monitorId, alertType, "email", message);
}
