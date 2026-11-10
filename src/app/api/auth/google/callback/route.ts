import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { upsertUser } from "@/lib/db";
import { appOrigin } from "@/lib/origin";
import { getSession } from "@/lib/session";

type GoogleUser = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const saved = jar.get("nucleo_oauth_state")?.value;

  if (!code || !state || !saved || state !== saved) {
    redirect("/login?error=estado");
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  const origin = appOrigin();
  if (!clientId || !clientSecret || !origin) redirect("/login?error=config");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) redirect("/login?error=google");
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) redirect("/login?error=google");

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) redirect("/login?error=google");

  const profile = (await profileResponse.json()) as GoogleUser;
  if (!profile.sub || !profile.email) redirect("/login?error=google");

  const session = await getSession();
  session.userId = `google:${profile.sub}`;
  session.email = profile.email;
  session.name = profile.name || profile.email;
  if (profile.picture) session.image = profile.picture;
  await session.save();
  await upsertUser(session.userId, session.email, session.name);
  jar.delete("nucleo_oauth_state");
  redirect("/dashboard");
}
