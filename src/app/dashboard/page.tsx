import { Suspense } from "react";
import { ProcessForm } from "@/components/process-form";
import { Shell, ShellFallback } from "@/components/shell";
import { SubmitForm } from "@/components/submit-form";
import { getCurrentUser } from "@/lib/auth";

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
  const aviso = first((await searchParams).aviso);

  return (
    <Shell user={user} current="dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Enviar programa</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Elige la hora al enviarlo. El cron lo corre a partir de ese momento. El play ejecuta lo que ya está en
            tiempo.
          </p>
        </div>
        <ProcessForm returnTo="/dashboard" />
      </div>

      {aviso ? (
        <p className="banner" role="alert">
          {aviso}
        </p>
      ) : null}

      <SubmitForm />
    </Shell>
  );
}
