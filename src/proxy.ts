import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "nucleo_session";

function needsAuth(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/historial" ||
    pathname.startsWith("/historial/") ||
    pathname.startsWith("/ejecuciones/")
  );
}

/** Sin cookie de sesión, las páginas internas vuelven al login. */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (needsAuth(request.nextUrl.pathname) && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/historial",
    "/historial/:path*",
    "/ejecuciones/:path*",
  ],
};
