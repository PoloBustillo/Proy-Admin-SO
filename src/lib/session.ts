import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { io } from "next/cache";
import { cookies } from "next/headers";

export type SessionData = {
  userId: string;
  email: string;
  name: string;
  image?: string;
};

export const SESSION_COOKIE = "nucleo_session";

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_PASSWORD;
  if (!password || password.length < 32) {
    throw new Error("SESSION_PASSWORD debe tener al menos 32 caracteres.");
  }

  return {
    cookieName: SESSION_COOKIE,
    password,
    ttl: 60 * 60 * 24 * 14,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

/** Lee la cookie firmada. io() evita que Next prerenderice el reloj de la sesión. */
export async function getSession(): Promise<IronSession<SessionData>> {
  await io();
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}
