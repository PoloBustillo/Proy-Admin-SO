import { claimSubmission, completeSubmission, listRunnable } from "@/lib/db";
import { executeJob } from "@/lib/runner";
import { readSource } from "@/lib/storage";
import type { JobResult } from "@/lib/types";

export type QueueItem = { id: string; exitCode: number };

function failed(id: string, startedAt: string, stderr: string): JobResult {
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

/**
 * Corre los trabajos cuya hora ya llegó.
 * La llama el cron (scripts/worker.ts) y también el botón de play.
 * No es un servicio aparte: es esta función.
 */
export async function runQueue(limit = 20): Promise<QueueItem[]> {
  const pending = await listRunnable(limit);
  const done: QueueItem[] = [];

  for (const job of pending) {
    // El UPDATE solo afecta filas todavía en cola, así que dos cron a la vez no corren el mismo trabajo.
    const claimed = await claimSubmission(job.id);
    if (!claimed) continue;

    const startedAt = new Date().toISOString();
    try {
      const source = await readSource(job.id);
      const result =
        source == null
          ? failed(job.id, startedAt, "El trabajo no tiene el archivo fuente.\n")
          : await executeJob({
              id: job.id,
              language: job.language,
              filename: job.filename,
              source,
              stdin: job.stdin || "",
            });
      await completeSubmission(job.id, result);
      done.push({ id: job.id, exitCode: result.exitCode });
    } catch (error) {
      const stderr = error instanceof Error ? `${error.message}\n` : "Fallo al ejecutar.\n";
      const result = failed(job.id, startedAt, stderr);
      await completeSubmission(job.id, result);
      done.push({ id: job.id, exitCode: result.exitCode });
    }
  }

  return done;
}
