"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session-token";

export type LoginState = { error: string | null };

/** Vergleicht zwei Strings in konstanter Zeit (Hashes haben immer gleiche Länge). */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/** Nur relative Pfade innerhalb der App erlauben (verhindert Open Redirects). */
function safeNextPath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : "/";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const expected = process.env.APP_PASSWORD?.trim();
  if (!expected || !process.env.AUTH_SECRET?.trim()) {
    return { error: "APP_PASSWORD und AUTH_SECRET sind nicht gesetzt – siehe README, Schritt 1." };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !safeEqual(password, expected)) {
    // Kleine Bremse gegen automatisiertes Durchprobieren
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { error: "Falsches Passwort." };
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true, // für JavaScript im Browser unsichtbar
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect(safeNextPath(formData.get("next")));
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
