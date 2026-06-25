import { startWeeklyReportWorker } from "@/lib/queue";

const worker = startWeeklyReportWorker();

if (!worker) {
  console.warn("Weekly report worker not started. Set REDIS_URL to enable BullMQ.");
  process.exit(0);
}

worker.on("ready", () => {
  console.log("Weekly report worker ready");
});

worker.on("completed", (job) => {
  console.log(`Weekly report job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Weekly report job failed: ${job?.id ?? "unknown"}`, error);
});
