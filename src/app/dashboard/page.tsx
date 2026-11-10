import { Suspense } from "react";
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
          <h1 className="text-2xl font-semibold">Proyecto Sistema Operativos</h1>
        </div>
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
