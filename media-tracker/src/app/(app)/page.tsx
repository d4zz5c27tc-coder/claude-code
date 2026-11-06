import { Suspense } from "react";
import { connection } from "next/server";
import { ENV_OVERVIEW } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";

/**
 * Startseite – vorerst ein Setup-Check, der zeigt, welche Umgebungsvariablen
 * gesetzt sind und ob die Datenbank erreichbar ist. Wird in den nächsten
 * Schritten durch Bibliothek und "Neu"-Feed ergänzt.
 */
export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Setup-Check</h1>
        <p className="text-sm text-muted">Hier siehst du, was schon eingerichtet ist.</p>
      </div>
      {/* Wird bei jedem Aufruf neu geprüft, nicht beim Build */}
      <Suspense fallback={<p className="text-sm text-muted">Prüfe…</p>}>
        <SetupStatus />
      </Suspense>
    </div>
  );
}

async function SetupStatus() {
  await connection();
  const db = await checkDatabase();

  return (
    <>
      {ENV_OVERVIEW.map((group) => (
        <section key={group.group} className="rounded-xl border border-border bg-surface-raised p-4">
          <h2 className="mb-3 font-medium">{group.group}</h2>
          <ul className="flex flex-col gap-2">
            {group.vars.map((v) => (
              <StatusRow key={v.name} ok={v.isSet()} label={v.name} detail={v.hint} />
            ))}
          </ul>
        </section>
      ))}
      <section className="rounded-xl border border-border bg-surface-raised p-4">
        <h2 className="mb-3 font-medium">Datenbank</h2>
        <ul>
          <StatusRow ok={db.ok} label="Supabase-Schema" detail={db.message} />
        </ul>
      </section>
    </>
  );
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-baseline gap-3 text-sm">
      <span aria-hidden className={ok ? "text-success" : "text-danger"}>
        {ok ? "✓" : "✗"}
      </span>
      <span className="font-mono">{label}</span>
      <span className="text-muted">{detail}</span>
      <span className="sr-only">{ok ? "eingerichtet" : "fehlt"}</span>
    </li>
  );
}

async function checkDatabase(): Promise<{ ok: boolean; message: string }> {
  try {
    const { data, error } = await getSupabase()
      .from("app_state")
      .select("id, last_poll_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      // Netzwerkfehler (falsche URL) von fehlenden Tabellen unterscheiden
      const hint = /fetch failed|ENOTFOUND|ECONNREFUSED/i.test(error.message)
        ? "Supabase nicht erreichbar – SUPABASE_URL prüfen."
        : "Migration ausgeführt und Secret-Key korrekt? (README, Schritt 1)";
      return { ok: false, message: `${hint} (${error.message})` };
    }
    if (!data) return { ok: false, message: "Tabelle app_state ist leer – Migration erneut ausführen." };
    return { ok: true, message: "Verbunden, Tabellen gefunden." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
