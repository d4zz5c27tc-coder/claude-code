import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session-token";

/**
 * Prüft in Server Actions und Route Handlers, ob du eingeloggt bist.
 *
 * Der Proxy (src/proxy.ts) leitet zwar schon alle nicht eingeloggten Aufrufe
 * auf /login um. Server Actions sind aber eigene HTTP-Endpunkte, deshalb
 * prüfen wir dort zusätzlich – so empfiehlt es auch die Next.js-Doku.
 */
export async function requireSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) {
    throw new Error("Nicht angemeldet");
  }
}
