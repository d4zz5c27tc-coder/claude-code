import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

/**
 * Passwortschutz für die gesamte App (Proxy hieß bis Next.js 15 "Middleware").
 *
 * Läuft vor jeder Anfrage, außer für die im `matcher` ausgenommenen Pfade:
 * - /login           → muss ohne Login erreichbar sein
 * - /api/poll        → wird von GitHub Actions aufgerufen und prüft stattdessen POLL_SECRET
 * - statische Dateien
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  // API-Aufrufe bekommen einen 401 statt einer Weiterleitung
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!login|api/poll|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
