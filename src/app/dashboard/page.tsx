import { Suspense } from "react";
import { Shell, ShellFallback } from "@/components/shell";
import { SubmitForm } from "@/components/submit-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Enviar" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await getCurrentUser();

  return (
    <Shell user={user} current="dashboard">
      <h1 className="text-2xl font-semibold">Proyecto Sistema Operativos</h1>
      <SubmitForm />
    </Shell>
  );
}
