# Media-Tracker

Persönlicher Tracker für Anime, Manga, Filme und Serien – eine Mischung aus
MyAnimeList und IMDb für eine einzelne Person. Kern-Feature: Benachrichtigung
per Telegram, sobald auf MangaDex ein neues Kapitel eines verfolgten Manga
erscheint.

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind CSS 4) · Supabase
(Postgres) · Vercel · GitHub Actions · Telegram-Bot

**Datenquellen:** [AniList](https://anilist.co) (Anime/Manga-Metadaten),
[MangaDex](https://mangadex.org) (neue Kapitel), [TMDB](https://www.themoviedb.org)
(Filme/Serien)

## Bauplan

| Schritt | Inhalt | Stand |
| --- | --- | --- |
| 1 | Projekt-Setup, Datenbank-Schema, Passwortschutz, Setup-Check | ✅ fertig |
| 2 | Suche (AniList + TMDB) und Bibliothek (Status, Fortschritt, Bewertung, Notizen) | offen |
| 3 | „Neu seit deinem letzten Besuch“-Feed (MangaDex-Abgleich beim Öffnen) | offen |
| 4 | Telegram-Alerts über `/api/poll` + GitHub-Actions-Cron alle 30 Minuten | offen |

## Projektstruktur

```
media-tracker/
├── supabase/migrations/0001_init.sql   Datenbank-Schema (im Supabase SQL Editor ausführen)
├── src/proxy.ts                        Passwortschutz für alle Seiten
├── src/lib/
│   ├── env.ts                          Umgebungsvariablen lesen/prüfen
│   ├── supabase.ts                     Serverseitiger DB-Client
│   ├── session-token.ts                Signierte Login-Cookies
│   ├── auth.ts                         Login-Prüfung für Server Actions
│   └── database.types.ts               TypeScript-Typen der Tabellen
└── src/app/
    ├── login/                          Login-Seite + Login/Logout-Actions
    └── (app)/                          Alle Seiten hinter dem Login
```

### Datenbank-Tabellen

- **`library_entries`** – deine Bibliothek: Quelle (AniList/TMDB), Typ, Titel,
  Cover, Status (`current`, `completed`, `planned`, `paused`, `dropped`),
  Fortschritt (Kapitel/Episode, Dezimal erlaubt für Kapitel wie 105.5),
  Staffel, Bewertung 1–10, Notizen.
- **`manga_tracking`** – Verknüpfung eines Manga mit seiner MangaDex-ID,
  gewünschte Sprache, Benachrichtigung an/aus und der „Cursor“ (zuletzt
  bekanntes Kapitel mit Zeitstempel).
- **`chapter_events`** – jedes neu erkannte Kapitel. `seen_at` steuert den
  „Neu“-Feed, `notified_at` die Telegram-Nachricht. Doppelte Uploads
  verschiedener Scanlation-Gruppen werden per eindeutigem Index auf
  (Manga, Sprache, Kapitelnummer) zusammengefasst.
- **`app_state`** – eine einzige Zeile mit globalem Zustand (letzter Besuch,
  letzter Poll-Lauf).

Sicherheit: Die App spricht die Datenbank **nur serverseitig** mit dem
Secret-Key an. Auf allen Tabellen ist Row Level Security aktiv, ohne Policies –
mit dem öffentlichen Publishable-/Anon-Key ist nichts lesbar.

---

## Einrichtung Schritt für Schritt

Voraussetzungen: [Node.js](https://nodejs.org) 20.9 oder neuer, ein
GitHub-Konto. Alle genutzten Dienste haben einen kostenlosen Tarif.

```bash
cd media-tracker
npm install
cp .env.example .env.local     # hier trägst du gleich alle Werte ein
```

### 1. Supabase (Datenbank)

1. Auf <https://supabase.com> registrieren und **New project** anlegen.
   Name frei wählbar, Datenbank-Passwort generieren lassen (brauchst du für
   diese App nicht, aber gut aufheben), Region möglichst nah (z.B. Frankfurt).
2. **Schema anlegen:** im Projekt links **SQL Editor** öffnen → **New query** →
   den kompletten Inhalt von `supabase/migrations/0001_init.sql` einfügen →
   **Run**. Es sollte „Success. No rows returned“ erscheinen. Unter
   **Table Editor** siehst du danach die vier Tabellen.
3. **`SUPABASE_URL`:** oben auf **Connect** klicken oder unter
   **Project Settings → Data API** die **Project URL** kopieren
   (Form `https://<projekt-id>.supabase.co`).
4. **`SUPABASE_SECRET_KEY`:** **Project Settings → API Keys**. Dort unter
   „Secret keys“ einen Key anlegen/anzeigen und kopieren (beginnt mit
   `sb_secret_`). Ältere Projekte haben stattdessen im Tab **Legacy API Keys**
   den `service_role`-Key – der funktioniert genauso.

> **Hinweis zum Anon-Key:** Den `anon`/Publishable-Key brauchst du für diese
> App nicht. Weil alle Datenbankzugriffe auf dem Server laufen, reicht der
> Secret-Key – und es gibt keinen öffentlichen Schlüssel, über den jemand an
> deine Daten kommen könnte. Den Secret-Key niemals committen oder in Code
> einbauen, der im Browser läuft.

> **Gratis-Tarif:** Supabase pausiert kostenlose Projekte nach etwa einer Woche
> ohne Aktivität. Sobald der Poll-Job aus Schritt 4 alle 30 Minuten läuft,
> passiert das nicht mehr. Ein pausiertes Projekt lässt sich im Dashboard mit
> einem Klick wieder starten.

### 2. Login-Passwort

- **`APP_PASSWORD`:** ein selbst gewähltes, langes Passwort. Da die App im
  Internet erreichbar ist, lieber 4–5 zufällige Wörter als ein kurzes Passwort.
- **`AUTH_SECRET`:** ein Zufallswert, mit dem das Login-Cookie signiert wird:

  ```bash
  openssl rand -hex 32
  ```

  (Ohne OpenSSL: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

Änderst du später eines der beiden, wirst du überall automatisch abgemeldet.

### 3. TMDB (Filme & Serien) – wird ab Schritt 2 gebraucht

1. Auf <https://www.themoviedb.org/signup> ein Konto anlegen und die E-Mail
   bestätigen.
2. Oben rechts auf dein Profil → **Einstellungen** → links **API**.
3. Einen API-Schlüssel beantragen (Typ „Developer“, private Nutzung). Das
   Formular fragt nach Name, Adresse und einer kurzen Beschreibung – „privater
   Medien-Tracker“ und als URL `http://localhost` reichen.
4. Danach zeigt die Seite zwei Werte: **API-Schlüssel** (kurz, v3) und
   **API-Lesezugriffstoken** (lang, beginnt mit `eyJ`, v4). Einen davon als
   **`TMDB_API_KEY`** eintragen – die App erkennt beide Formate.

Hinweis: TMDB verlangt bei Nutzung der API eine Quellenangabe; die App zeigt
einen entsprechenden Hinweis an.

### 4. Telegram-Bot – wird ab Schritt 4 gebraucht

**`TELEGRAM_BOT_TOKEN`:**

1. In Telegram den offiziellen Account **@BotFather** öffnen (blauer Haken).
2. `/newbot` senden, einen Anzeigenamen und dann einen Benutzernamen wählen,
   der auf `bot` endet (z.B. `julian_manga_alerts_bot`).
3. BotFather antwortet mit dem Token im Format `123456789:AAH…` – das ist
   `TELEGRAM_BOT_TOKEN`. Wie ein Passwort behandeln.

**`TELEGRAM_CHAT_ID`:**

1. Deinen neuen Bot in Telegram suchen, öffnen und **Start** drücken bzw.
   irgendeine Nachricht schicken. (Bots dürfen dir erst schreiben, nachdem du
   ihnen geschrieben hast.)
2. Im Browser aufrufen (Token einsetzen):
   `https://api.telegram.org/bot<DEIN_TOKEN>/getUpdates`
3. In der Antwort steht `"chat":{"id":123456789,…}` – diese Zahl ist
   `TELEGRAM_CHAT_ID`. Kommt nur `"result":[]` zurück, dem Bot noch einmal
   schreiben und die Seite neu laden.

### 5. `POLL_SECRET` – wird ab Schritt 4 gebraucht

Ein Zufallswert, der die Route `/api/poll` schützt, damit nur dein
GitHub-Actions-Job sie auslösen kann:

```bash
openssl rand -hex 32
```

Denselben Wert trägst du später in Vercel **und** als GitHub-Secret ein.

### 6. Lokal starten

```bash
npm run dev
```

<http://localhost:3000> öffnen, mit `APP_PASSWORD` anmelden. Die Startseite
zeigt einen **Setup-Check**: welche Variablen gesetzt sind und ob die
Datenbank erreichbar ist. Bei „Datenbank ✓“ ist Schritt 1 erledigt.

### 7. Auf Vercel deployen

1. Code auf GitHub pushen.
2. Auf <https://vercel.com> mit GitHub anmelden → **Add New… → Project** →
   das Repository importieren.
3. **Root Directory:** auf `media-tracker` stellen, solange die App in diesem
   Unterordner liegt (liegt sie im Wurzelverzeichnis eines eigenen Repos,
   einfach leer lassen). Framework wird automatisch als Next.js erkannt.
4. Unter **Environment Variables** alle Werte aus deiner `.env.local`
   eintragen (gleiche Namen). Tipp: Den Inhalt der `.env.local` kannst du dort
   komplett einfügen, Vercel erkennt die einzelnen Zeilen.
5. **Deploy**. Danach bekommst du eine URL wie `https://media-tracker-xyz.vercel.app`.
6. Ändern sich später Variablen: **Settings → Environment Variables** anpassen
   und unter **Deployments** → „…“ → **Redeploy** auslösen – neue Werte
   greifen erst nach einem neuen Deployment.

### 8. GitHub-Actions-Secrets – wird ab Schritt 4 gebraucht

Der Workflow (kommt in Schritt 4) ruft alle 30 Minuten deine Vercel-URL auf.
Dafür braucht er zwei Secrets:

1. Auf GitHub im Repository: **Settings → Secrets and variables → Actions →
   New repository secret**.
2. `POLL_SECRET` = derselbe Wert wie in Vercel.
3. `POLL_URL` = deine Vercel-Adresse mit Pfad, z.B.
   `https://media-tracker-xyz.vercel.app/api/poll`.

Wichtig zu wissen:

- Zeitgesteuerte Workflows laufen **nur auf dem Standard-Branch** (meist `main`).
- In einem **Fork** sind Workflows anfangs deaktiviert – im Tab **Actions**
  einmal aktivieren.
- GitHub garantiert keine exakten Zeiten; Läufe starten oft einige Minuten
  verspätet. Bei öffentlichen Repos ohne Commits über 60 Tage deaktiviert
  GitHub zeitgesteuerte Workflows – dann im Tab **Actions** wieder aktivieren.

---

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver auf Port 3000 |
| `npm run build` | Produktions-Build (prüft auch TypeScript) |
| `npm run start` | Produktions-Build lokal starten |
| `npm run lint` | ESLint |
