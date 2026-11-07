import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-16">
      <header className="flex items-baseline justify-between gap-4">
        <p className="text-lg font-semibold">Núcleo</p>
        <Link href="/login" className="btn btn-primary">
          Entrar
        </Link>
      </header>
      <ul className="mt-10 list-disc space-y-2 pl-5 leading-7">
        <li>El programa se guarda por FTP en esta máquina.</li>
        <li>Un cron lo ejecuta.</li>
        <li>La ejecución y el resultado quedan en PostgreSQL.</li>
      </ul>
      <p className="mt-8 leading-7">Python, Java, C o C++. Si falla, se muestra el error.</p>
    </main>
  );
}
