import { prisma } from "../src/lib/prisma";
import { resetDemoWorkspace } from "../src/lib/demo";
import { scheduleDemoResetJob } from "../src/lib/queue";

async function main() {
  const result = await resetDemoWorkspace(prisma);

  console.log(`Demo workspace seeded: ${result.organizationId}`);
  const scheduler = await scheduleDemoResetJob().catch(() => null);
  if (!scheduler) {
    console.warn("Demo reset schedule was not created because Redis is unavailable.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
