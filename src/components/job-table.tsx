import Link from "next/link";
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
          <li key={job.id}>
            <Link href={`/ejecuciones/${job.id}`} className="flex items-center justify-between gap-4 px-4 py-3 no-underline">
              <span className="min-w-0">
                <span className="block truncate font-mono text-sm text-ink">{job.filename}</span>
                <span className="text-sm text-ink-soft">
                  {languageLabel(job.language)} · {formatWhen(job.createdAt)}
                </span>
              </span>
              <StatusPill kind={kind} code={job.exitCode} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
