import "server-only";

/**
 * Zentrale Stelle für Umgebungsvariablen.
 *
 * Werte werden erst beim Gebrauch gelesen (nicht beim Import), damit die App
 * auch dann baut und startet, wenn z.B. der Telegram-Teil noch nicht
 * eingerichtet ist. Fehlt ein Wert, gibt es eine verständliche Fehlermeldung.
 */

export function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(
      `Umgebungsvariable ${name} fehlt. Trage sie in .env.local (lokal) bzw. in den Vercel-Projekteinstellungen ein – siehe README.`,
    );
  }
  return value;
}

/** Supabase Secret-Key. Akzeptiert auch den älteren Namen SUPABASE_SERVICE_ROLE_KEY. */
export function readSupabaseSecretKey(): string | undefined {
  return readEnv("SUPABASE_SECRET_KEY") ?? readEnv("SUPABASE_SERVICE_ROLE_KEY");
}

/** Übersicht aller Variablen – wird auf der Setup-Seite angezeigt. */
export const ENV_OVERVIEW: {
  group: string;
  vars: { name: string; isSet: () => boolean; hint: string }[];
}[] = [
  {
    group: "Grundlagen (Schritt 1)",
    vars: [
      { name: "APP_PASSWORD", isSet: () => !!readEnv("APP_PASSWORD"), hint: "Dein Login-Passwort" },
      { name: "AUTH_SECRET", isSet: () => !!readEnv("AUTH_SECRET"), hint: "Zufallswert zum Signieren des Login-Cookies" },
      { name: "SUPABASE_URL", isSet: () => !!readEnv("SUPABASE_URL"), hint: "Project URL aus Supabase" },
      {
        name: "SUPABASE_SECRET_KEY",
        isSet: () => !!readSupabaseSecretKey(),
        hint: "Secret-Key (oder Legacy service_role-Key) aus Supabase",
      },
    ],
  },
  {
    group: "Suche (Schritt 2)",
    vars: [{ name: "TMDB_API_KEY", isSet: () => !!readEnv("TMDB_API_KEY"), hint: "Für Filme & Serien" }],
  },
  {
    group: "Telegram-Alerts (Schritt 4)",
    vars: [
      { name: "TELEGRAM_BOT_TOKEN", isSet: () => !!readEnv("TELEGRAM_BOT_TOKEN"), hint: "Von @BotFather" },
      { name: "TELEGRAM_CHAT_ID", isSet: () => !!readEnv("TELEGRAM_CHAT_ID"), hint: "Deine Chat-ID" },
      { name: "POLL_SECRET", isSet: () => !!readEnv("POLL_SECRET"), hint: "Schützt /api/poll" },
    ],
  },
];
