import { claimSubmission, completeSubmission, listRunnable } from "@/lib/db";
import { executeJob } from "@/lib/runner";
import { readSource } from "@/lib/storage";
import type { JobResult } from "@/lib/types";

export type QueueItem = { id: string; exitCode: number };

function brokenResult(id: string, startedAt: string, stderr: string): JobResult {
  return {
    id,
    exitCode: 1,
    stdout: "",
    stderr,
    command: "",
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

export async function runQueue(limit = 20): Promise<QueueItem[]> {
  const pending = await listRunnable(limit);
  const summary: QueueItem[] = [];

  for (const job of pending) {
    const claimed = await claimSubmission(job.id);
    if (!claimed) continue;

    const startedAt = new Date().toISOString();
    const source = await readSource(job.id);
    if (source == null) {
      const broken = brokenResult(job.id, startedAt, "El trabajo no tiene el archivo fuente.\n");
      await completeSubmission(job.id, broken);
      summary.push({ id: job.id, exitCode: broken.exitCode });
      continue;
    }

    try {
      const result = await executeJob({
        id: job.id,
        language: job.language,
        filename: job.filename,
        source,
        stdin: job.stdin || "",
      });
      await completeSubmission(job.id, result);
      summary.push({ id: job.id, exitCode: result.exitCode });
    } catch (error) {
      const stderr = error instanceof Error ? `${error.message}\n` : "Fallo al ejecutar.\n";
      const broken = brokenResult(job.id, startedAt, stderr);
      await completeSubmission(job.id, broken);
      summary.push({ id: job.id, exitCode: broken.exitCode });
    }
  }

  return summary;
}
