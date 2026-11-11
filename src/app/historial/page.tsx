import { Suspense } from "react";
import { JobTable } from "@/components/job-table";
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

  return (
    <Shell user={user} current="historial">
      <h1 className="text-2xl font-semibold">Historial</h1>
      <JobTable jobs={jobs} />
    </Shell>
  );
}
