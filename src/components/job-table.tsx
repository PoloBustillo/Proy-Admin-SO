import Link from "next/link";
import { DeleteJobForm } from "@/components/delete-job";
import { StatusPill } from "@/components/status-pill";
import { formatWhen, languageLabel, outcome } from "@/lib/format";
import type { Submission } from "@/lib/types";

export function JobTable({ jobs }: { jobs: Submission[] }) {
  if (jobs.length === 0) {
    return (
      <p className="card px-4 py-6 text-ink-soft">
        Todavía no hay ejecuciones. Cuando envíes un programa, aparecerá aquí.
      </p>
    );
  }

  return (
    <ul className="card divide-y divide-line">
      {jobs.map((job) => {
        const kind = outcome(job);
        return (
          <li key={job.id} className="flex items-center gap-3 px-4 py-3">
            <Link href={`/ejecuciones/${job.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-4 no-underline">
              <span className="min-w-0">
                <span className="block truncate font-mono text-sm text-ink">{job.filename}</span>
                <span className="text-sm text-ink-soft">
                  {languageLabel(job.language)} · {job.scheduled ? `programado ${formatWhen(job.runAt)}` : "ahora"}
                </span>
              </span>
              <StatusPill kind={kind} code={job.exitCode} />
            </Link>
            <DeleteJobForm id={job.id} />
          </li>
        );
      })}
    </ul>
  );
}
