import Link from "next/link";
import { Suspense } from "react";
import { JobTable } from "@/components/job-table";
import { LiveRefresh } from "@/components/live-refresh";
import { ProcessForm } from "@/components/process-form";
import { Shell, ShellFallback } from "@/components/shell";
import { SubmitForm } from "@/components/submit-form";
import { getCurrentUser } from "@/lib/auth";
import { listByUser } from "@/lib/db";

export const metadata = { title: "Enviar" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  const jobs = await listByUser(user.id);
  const aviso = first((await searchParams).aviso);
  const waiting = jobs.some((job) => job.status !== "finished");

  return (
    <Shell user={user} current="dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Enviar programa</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Queda en cola. El cron de la VPS lo ejecuta después. Aquí puedes correr la cola ahora para ver el resultado
            sin esperar.
          </p>
        </div>
        <ProcessForm returnTo="/dashboard" />
      </div>

      {aviso ? (
        <p className="banner" role="alert">
          {aviso}
        </p>
      ) : null}

      <LiveRefresh active={waiting} />
      <SubmitForm />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold">Recientes</h2>
          <Link href="/historial" className="text-sm font-semibold text-ink">
            Ver historial
          </Link>
        </div>
        <JobTable jobs={jobs.slice(0, 6)} />
      </section>

      <details className="card p-4">
        <summary className="cursor-pointer font-semibold">Cron en la VPS</summary>
        <p className="mt-3 text-sm text-ink-soft">
          El worker lee el archivo que dejó el FTP, lo ejecuta y guarda stdout, stderr y el estado en PostgreSQL.
        </p>
        <pre className="pane mt-3">{`* * * * * cd /ruta/del/proyecto && npm run worker >> /tmp/nucleo-worker.log 2>&1`}</pre>
      </details>
    </Shell>
  );
}
