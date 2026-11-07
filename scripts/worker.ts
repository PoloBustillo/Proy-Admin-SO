import { loadEnvFiles } from "./load-env";

loadEnvFiles();

async function main() {
  const { runQueue } = await import("../src/lib/queue");
  const summary = await runQueue();
  if (summary.length === 0) {
    console.log("Sin trabajos pendientes.");
  } else {
    for (const item of summary) {
      console.log(`${item.id}  salida ${item.exitCode}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
