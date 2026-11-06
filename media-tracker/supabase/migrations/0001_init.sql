-- =============================================================================
-- Media-Tracker – initiales Datenbank-Schema
--
-- Ausführen: Supabase-Dashboard → SQL Editor → diesen Inhalt einfügen → "Run".
-- Das Skript ist idempotent geschrieben (if not exists / or replace), ein
-- zweiter Durchlauf richtet also keinen Schaden an.
--
-- Sicherheitsmodell: Die App greift NUR serverseitig mit dem Secret-Key
-- (bzw. Legacy "service_role"-Key) auf die Datenbank zu. Row Level Security
-- ist auf allen Tabellen aktiv, aber es gibt bewusst KEINE Policies – damit
-- kommt man mit dem öffentlichen Publishable-/Anon-Key an gar nichts heran.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Hilfsfunktion: updated_at automatisch setzen
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- library_entries: ein Titel in deiner persönlichen Bibliothek
-- (Anime/Manga von AniList, Filme/Serien von TMDB)
-- -----------------------------------------------------------------------------
create table if not exists public.library_entries (
  id              uuid primary key default gen_random_uuid(),

  -- Herkunft der Metadaten. source_id ist die ID in der jeweiligen Quelle
  -- (als Text, damit AniList- und TMDB-IDs in dieselbe Spalte passen).
  source          text not null check (source in ('anilist', 'tmdb')),
  source_id       text not null,
  media_type      text not null check (media_type in ('anime', 'manga', 'movie', 'tv')),

  -- Kopie der wichtigsten Metadaten, damit die Bibliothek ohne API-Aufruf
  -- angezeigt werden kann.
  title           text not null,
  title_alt       text,                -- z.B. Originaltitel / Romaji
  cover_url       text,
  release_year    smallint,
  total_units     integer check (total_units is null or total_units >= 0),
                                       -- Episoden bzw. Kapitel gesamt (falls bekannt)

  -- Persönliche Daten
  status          text not null default 'planned'
                  check (status in ('current', 'completed', 'planned', 'paused', 'dropped')),
  -- numeric statt integer, weil es Kapitel wie "105.5" gibt
  progress        numeric(7, 1) not null default 0 check (progress >= 0),
  progress_season smallint check (progress_season is null or progress_season >= 0),
                                       -- nur für Serien relevant
  rating          smallint check (rating between 1 and 10),
  notes           text,
  started_on      date,
  finished_on     date,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- AniList liefert nur Anime/Manga, TMDB nur Filme/Serien
  constraint library_entries_source_matches_type check (
    (source = 'anilist' and media_type in ('anime', 'manga'))
    or (source = 'tmdb' and media_type in ('movie', 'tv'))
  ),
  -- Jeder Titel nur einmal. media_type gehört dazu, weil TMDB-IDs für
  -- Filme und Serien getrennt vergeben werden (Film 123 ≠ Serie 123).
  constraint library_entries_unique_title unique (source, source_id, media_type)
);

create index if not exists library_entries_status_idx
  on public.library_entries (status, updated_at desc);
create index if not exists library_entries_type_idx
  on public.library_entries (media_type, updated_at desc);

drop trigger if exists library_entries_updated_at on public.library_entries;
create trigger library_entries_updated_at
  before update on public.library_entries
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- manga_tracking: Verknüpfung eines Manga mit MangaDex + Stand der Kapitel-
-- Erkennung. Existiert nur für Manga, die auf neue Kapitel überwacht werden.
-- -----------------------------------------------------------------------------
create table if not exists public.manga_tracking (
  entry_id            uuid primary key
                      references public.library_entries (id) on delete cascade,
  mangadex_id         uuid not null,
  -- Sprache der Kapitel, die gemeldet werden sollen (MangaDex-Code, z.B. 'en', 'de')
  language            text not null default 'en',
  -- Telegram-Benachrichtigung für diesen Manga an/aus
  notify              boolean not null default true,

  -- "Cursor": das neueste Kapitel, das wir bereits kennen.
  -- Neue Kapitel = alles, was auf MangaDex danach lesbar wurde.
  last_chapter_id     uuid,
  last_chapter_number text,            -- MangaDex liefert Kapitelnummern als Text
  last_readable_at    timestamptz,

  last_checked_at     timestamptz,     -- letzter Abgleich mit MangaDex
  last_error          text,            -- letzte Fehlermeldung (zur Fehlersuche)

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists manga_tracking_checked_idx
  on public.manga_tracking (last_checked_at nulls first);

drop trigger if exists manga_tracking_updated_at on public.manga_tracking;
create trigger manga_tracking_updated_at
  before update on public.manga_tracking
  for each row execute function public.set_updated_at();

-- Sicherstellen, dass nur Manga-Einträge getrackt werden (ein Fremdschlüssel
-- allein kann das nicht prüfen).
create or replace function public.ensure_tracking_is_manga()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.library_entries
    where id = new.entry_id and media_type = 'manga'
  ) then
    raise exception 'manga_tracking: Eintrag % ist kein Manga', new.entry_id;
  end if;
  return new;
end;
$$;

drop trigger if exists manga_tracking_is_manga on public.manga_tracking;
create trigger manga_tracking_is_manga
  before insert or update of entry_id on public.manga_tracking
  for each row execute function public.ensure_tracking_is_manga();


-- -----------------------------------------------------------------------------
-- chapter_events: jedes neu erkannte Kapitel landet hier.
-- Diese Tabelle speist sowohl den "Neu seit deinem letzten Besuch"-Feed
-- (seen_at) als auch die Telegram-Benachrichtigung (notified_at).
-- So bekommst du eine Telegram-Nachricht auch dann, wenn die App das Kapitel
-- zuerst beim Öffnen gefunden hat – und keine doppelte, wenn beide gleichzeitig
-- laufen.
-- -----------------------------------------------------------------------------
create table if not exists public.chapter_events (
  id                  uuid primary key default gen_random_uuid(),
  entry_id            uuid not null
                      references public.library_entries (id) on delete cascade,
  mangadex_chapter_id uuid not null,
  chapter_number      text,            -- null bei Oneshots
  volume              text,
  chapter_title       text,
  language            text not null,
  scanlation_group    text,
  readable_at         timestamptz not null,
  -- Manche Kapitel sind nur extern lesbar (z.B. offizielle Verlagsseiten)
  external_url        text,

  detected_at         timestamptz not null default now(),
  notified_at         timestamptz,     -- Telegram-Nachricht erfolgreich gesendet
  seen_at             timestamptz,     -- im Feed als gesehen markiert

  constraint chapter_events_unique_chapter unique (mangadex_chapter_id)
);

-- Ein Kapitel wird oft von mehreren Scanlation-Gruppen hochgeladen.
-- Pro Manga + Sprache + Kapitelnummer soll es nur EIN Ereignis geben
-- (also nur eine Benachrichtigung).
create unique index if not exists chapter_events_unique_number
  on public.chapter_events (entry_id, language, chapter_number)
  where chapter_number is not null;

create index if not exists chapter_events_entry_idx
  on public.chapter_events (entry_id, readable_at desc);
create index if not exists chapter_events_unnotified_idx
  on public.chapter_events (detected_at)
  where notified_at is null;
create index if not exists chapter_events_unseen_idx
  on public.chapter_events (readable_at desc)
  where seen_at is null;


-- -----------------------------------------------------------------------------
-- app_state: globale Einzelzeile (nur id = 1) für App-weiten Zustand
-- -----------------------------------------------------------------------------
create table if not exists public.app_state (
  id              smallint primary key default 1 check (id = 1),
  last_visit_at   timestamptz,         -- wann du die App zuletzt geöffnet hast
  last_poll_at    timestamptz,         -- letzter Lauf von /api/poll
  last_poll_error text,
  updated_at      timestamptz not null default now()
);

insert into public.app_state (id) values (1) on conflict (id) do nothing;

drop trigger if exists app_state_updated_at on public.app_state;
create trigger app_state_updated_at
  before update on public.app_state
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- Zugriffsrechte
-- -----------------------------------------------------------------------------
alter table public.library_entries enable row level security;
alter table public.manga_tracking  enable row level security;
alter table public.chapter_events  enable row level security;
alter table public.app_state       enable row level security;

-- Öffentliche Rollen bekommen gar nichts (doppelt abgesichert zusätzlich zu RLS).
revoke all on public.library_entries, public.manga_tracking,
              public.chapter_events, public.app_state
  from anon, authenticated;

-- Die Server-Rolle (Secret-/service_role-Key) darf alles. Explizit gesetzt,
-- falls in deinem Projekt neue Tabellen nicht automatisch freigegeben werden.
grant select, insert, update, delete on public.library_entries, public.manga_tracking,
              public.chapter_events, public.app_state
  to service_role;
