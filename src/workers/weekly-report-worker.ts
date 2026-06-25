import {
  scheduleDemoResetJob,
  scheduleSprintSnapshotJob,
  startDemoResetWorker,
  startSprintSnapshotWorker,
  startWeeklyReportWorker,
} from "@/lib/queue";

async function main() {
  const reportWorker = startWeeklyReportWorker();
  const demoResetWorker = startDemoResetWorker();
  const sprintSnapshotWorker = startSprintSnapshotWorker();

  if (!reportWorker || !demoResetWorker || !sprintSnapshotWorker) {
    console.warn("Background workers not started. Set REDIS_URL to enable BullMQ.");
    return;
  }

  await Promise.all([scheduleDemoResetJob(), scheduleSprintSnapshotJob()]);

  reportWorker.on("ready", () => {
    console.log("Weekly report worker ready");
  });

  reportWorker.on("completed", (job) => {
    console.log(`Weekly report job completed: ${job.id}`);
  });

  reportWorker.on("failed", (job, error) => {
    console.error(`Weekly report job failed: ${job?.id ?? "unknown"}`, error);
  });

  demoResetWorker.on("ready", () => {
    console.log("Demo reset worker ready");
  });

  demoResetWorker.on("completed", (job) => {
    console.log(`Demo reset job completed: ${job.id}`);
  });

  demoResetWorker.on("failed", (job, error) => {
    console.error(`Demo reset job failed: ${job?.id ?? "unknown"}`, error);
  });

  sprintSnapshotWorker.on("ready", () => {
    console.log("Sprint snapshot worker ready");
  });

  sprintSnapshotWorker.on("completed", (job) => {
    console.log(`Sprint snapshot job completed: ${job.id}`);
  });

  sprintSnapshotWorker.on("failed", (job, error) => {
    console.error(`Sprint snapshot job failed: ${job?.id ?? "unknown"}`, error);
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
