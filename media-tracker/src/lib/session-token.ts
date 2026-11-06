/**
 * Signierte Login-Cookies für den einfachen Passwortschutz.
 *
 * Aufbau des Cookie-Werts: "<ablaufzeit-ms>.<hmac-signatur>"
 * Die Signatur wird mit AUTH_SECRET + APP_PASSWORD berechnet. Ändert sich
 * eines von beiden, werden alle bestehenden Logins automatisch ungültig.
 *
 * Nutzt nur die Web-Crypto-API, damit es sowohl im Proxy als auch in
 * Server Actions läuft. Kein "server-only"-Import, weil der Proxy diese
 * Datei ebenfalls lädt.
 */

export const SESSION_COOKIE = "mt_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 Tage

const encoder = new TextEncoder();

function getSecretMaterial(): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  const password = process.env.APP_PASSWORD?.trim();
  if (!secret || !password) return null;
  return `${secret}\u0000${password}`;
}

async function getKey(material: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(material),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Erzeugt einen neuen Cookie-Wert. Wirft, wenn AUTH_SECRET/APP_PASSWORD fehlen. */
export async function createSessionToken(): Promise<string> {
  const material = getSecretMaterial();
  if (!material) throw new Error("AUTH_SECRET und APP_PASSWORD müssen gesetzt sein.");
  const expiresAt = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const signature = await crypto.subtle.sign("HMAC", await getKey(material), encoder.encode(expiresAt));
  return `${expiresAt}.${toBase64Url(signature)}`;
}

/** Prüft einen Cookie-Wert. Fehlende Konfiguration = immer ungültig (fail closed). */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const material = getSecretMaterial();
  if (!material) return false;

  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || !/^\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) < Date.now()) return false;

  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes) return false;

  // crypto.subtle.verify vergleicht in konstanter Zeit (kein Timing-Leak)
  return crypto.subtle.verify("HMAC", await getKey(material), signatureBytes, encoder.encode(expiresAt));
}
