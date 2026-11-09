import { Suspense } from "react";
import { JobTable } from "@/components/job-table";
import { LiveRefresh } from "@/components/live-refresh";
import { Shell, ShellFallback } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { listByUser } from "@/lib/db";

export const metadata = { title: "Historial" };

export default function HistoryPage() {
  return (
    <Suspense fallback={<ShellFallback />}>
      <History />
    </Suspense>
  );
}

async function History() {
  const user = await getCurrentUser();
  const jobs = await listByUser(user.id);
  const waiting = jobs.some((job) => job.status !== "finished");

  return (
    <Shell user={user} current="historial">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Historial</h1>
          <p className="mt-2 text-ink-soft">Solo las ejecuciones de {user.email}.</p>
        </div>
      </div>
      <LiveRefresh active={waiting} />
      <JobTable jobs={jobs} />
    </Shell>
  );
}
