import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/session";

const ERRORS: Record<string, string> = {
  google: "No se pudo completar el acceso con Google.",
  config: "Google todavía no está conectado.",
  estado: "La verificación de Google expiró. Intenta otra vez.",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata = { title: "Entrar" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-ink-soft">Cargando…</p>}>
      <LoginSearch searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginSearch({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const error = first((await searchParams).error);
  return <LoginBody error={error} />;
}

async function LoginBody({ error }: { error?: string }) {
  const session = await getSession();
  if (session.userId && session.email) redirect("/dashboard");

  const message = error ? ERRORS[error] || "No se pudo entrar." : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <p className="text-sm">Núcleo</p>
      <h1 className="mt-2 text-2xl font-semibold">Entrar</h1>

      {message ? (
        <p className="banner mt-6" role="alert">
          {message}
        </p>
      ) : null}

      <div className="mt-6">
        <a href="/api/auth/google" className="btn btn-primary">
          Continuar con Google
        </a>
      </div>
    </main>
  );
}
