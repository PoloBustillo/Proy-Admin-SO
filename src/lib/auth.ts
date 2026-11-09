import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import type { CurrentUser } from "@/lib/types";

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await getSession();
  if (!session.userId || !session.email) redirect("/login");
  return {
    id: session.userId,
    email: session.email,
    name: session.name || session.email,
    image: session.image,
  };
}

export function googleAuthEnabled() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}
