import Link from "next/link";
import { logout } from "@/app/actions";
import type { CurrentUser } from "@/lib/types";

const links = [
  { href: "/dashboard", id: "dashboard", label: "Enviar" },
  { href: "/historial", id: "historial", label: "Historial" },
] as const;

export function Shell({
  user,
  current,
  children,
}: {
  user: CurrentUser;
  current: "dashboard" | "historial" | "run";
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-black">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
          <Link href="/dashboard" className="font-semibold no-underline">
            Núcleo
          </Link>
          <nav className="flex gap-4">
            {links.map((link) => {
              const active = current === link.id;
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  className={active ? "font-semibold underline" : "no-underline"}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="max-w-48 truncate text-ink-soft">{user.email}</span>
            <form action={logout}>
              <button type="submit" className="underline">
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8">{children}</main>
    </div>
  );
}

export function ShellFallback() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-black px-5 py-3 text-ink-soft">Núcleo</header>
      <p className="px-5 py-8 text-ink-soft">Cargando tu sesión…</p>
    </div>
  );
}
