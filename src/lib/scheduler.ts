import cron from "node-cron";
import { runChecksForPriority, seedMonitors } from "./checker";
import { cleanOldCheckResults } from "./db";

let isStarted = false;

export async function startScheduler(): Promise<void> {
  if (isStarted) return;
  isStarted = true;

  // Seed monitors on startup
  await seedMonitors();

  console.log("[scheduler] Starting health check scheduler...");

  // All monitors: every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    console.log("[scheduler] Running all checks...");
    try {
      const result = await runChecksForPriority();
      console.log(`[scheduler] Checked ${result.checked} monitors`);
    } catch (err) {
      console.error("[scheduler] Check error:", err);
    }
  });

  // Daily cleanup of old check results
  cron.schedule("0 3 * * *", async () => {
    console.log("[scheduler] Cleaning old check results...");
    await cleanOldCheckResults(90);
  });

  console.log("[scheduler] Scheduler started. All monitors every 5 minutes.");

  // Run an initial check of all monitors immediately
  setTimeout(async () => {
    console.log("[scheduler] Running initial check of all monitors...");
    try {
      const result = await runChecksForPriority();
      console.log(
        `[scheduler] Initial check: ${result.checked} monitors checked`,
      );
    } catch (err) {
      console.error("[scheduler] Initial check error:", err);
    }
  }, 3000);
}
