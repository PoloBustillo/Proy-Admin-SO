"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5">
      <p className="text-sm">Núcleo</p>
      <h1 className="mt-2 text-2xl font-semibold">No se pudo completar la página</h1>
      <pre className="pane mt-6">{error.message}</pre>
      <button type="button" className="btn btn-primary mt-6 w-fit" onClick={() => reset()}>
        Reintentar
      </button>
    </main>
  );
}
