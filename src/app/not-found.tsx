import Link from "next/link";

export const metadata = { title: "No encontrada" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5">
      <p className="text-sm">Núcleo</p>
      <h1 className="mt-2 text-2xl font-semibold">Esa ejecución no está en tu historial</h1>
      <p className="mt-3 text-ink-soft">Puede ser de otra cuenta, o el enlace ya no existe.</p>
      <Link href="/historial" className="btn btn-primary mt-6 w-fit">
        Volver al historial
      </Link>
    </main>
  );
}
