import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import type { CurrentUser } from "@/lib/types";

/** Usuario de la cookie. Si no hay sesión, manda al login. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await getSession();
  if (!session.userId || !session.email) redirect("/login");
  return {
    id: session.userId,
    email: session.email,
    name: session.name || session.email,
  };
}
