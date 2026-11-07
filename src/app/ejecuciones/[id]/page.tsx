import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import { ProcessForm } from "@/components/process-form";
import { Shell, ShellFallback } from "@/components/shell";
import { StatusPill } from "@/components/status-pill";
import { getCurrentUser } from "@/lib/auth";
import { getOwned } from "@/lib/db";
import { formatWhen, languageLabel, outcome } from "@/lib/format";

export const metadata = { title: "Ejecución" };

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Run params={params} />
    </Suspense>
  );
}

async function Run({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const job = await getOwned(id, user.id);
  if (!job) notFound();

  const kind = outcome(job);
  const waiting = job.status !== "finished";

  return (
    <Shell user={user} current="run">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/historial" className="text-sm font-semibold text-ink-soft">
            Historial
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl">{job.filename}</h1>
            <StatusPill kind={kind} code={job.exitCode} />
          </div>
        </div>
        <ProcessForm returnTo={`/ejecuciones/${job.id}`} />
      </div>

      <LiveRefresh active={waiting} />

      <dl className="card grid gap-4 p-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold tracking-[0.14em] text-ink-soft uppercase">Lenguaje</dt>
          <dd className="mt-1">{languageLabel(job.language)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-[0.14em] text-ink-soft uppercase">Enviado</dt>
          <dd className="mt-1">{formatWhen(job.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-[0.14em] text-ink-soft uppercase">Terminó</dt>
          <dd className="mt-1">{formatWhen(job.finishedAt)}</dd>
        </div>
      </dl>

      {job.command ? (
        <p className="text-sm text-ink-soft">
          Comando: <span className="font-mono text-ink">{job.command}</span>
        </p>
      ) : null}

      {waiting ? (
        <p className="card p-4 text-ink-soft">
          Sigue en cola. Cuando el cron —o el botón de arriba— lo ejecute, stdout y stderr aparecen aquí, incluido el
          error del compilador si lo hay.
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Programa</h2>
        <pre className="pane">{job.source}</pre>
      </section>

      {job.stdin ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Entrada estándar</h2>
          <pre className="pane border border-line bg-panel">{job.stdin}</pre>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="mb-2 text-lg font-semibold">stdout</h2>
          <pre className="pane border border-line bg-panel">
            {job.stdout || (waiting ? "Todavía no hay salida." : "Sin salida estándar.")}
          </pre>
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">stderr</h2>
          <pre className="pane">
            {job.stderr || (waiting ? "Todavía no hay salida." : "Sin errores.")}
          </pre>
        </div>
      </section>
    </Shell>
  );
}
