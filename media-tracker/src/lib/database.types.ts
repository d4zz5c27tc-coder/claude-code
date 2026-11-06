/**
 * TypeScript-Typen für das Datenbank-Schema (supabase/migrations/0001_init.sql).
 *
 * Von Hand gepflegt, damit kein Supabase-CLI nötig ist. Wenn du das Schema
 * änderst, passe diese Datei mit an. (Alternativ lassen sie sich mit
 * `npx supabase gen types typescript` erzeugen.)
 */

export type MediaSource = "anilist" | "tmdb";
export type MediaType = "anime" | "manga" | "movie" | "tv";
export type EntryStatus = "current" | "completed" | "planned" | "paused" | "dropped";

export type LibraryEntry = {
  id: string;
  source: MediaSource;
  source_id: string;
  media_type: MediaType;
  title: string;
  title_alt: string | null;
  cover_url: string | null;
  release_year: number | null;
  total_units: number | null;
  status: EntryStatus;
  /** Postgres numeric kommt über die REST-API als Zahl an */
  progress: number;
  progress_season: number | null;
  rating: number | null;
  notes: string | null;
  started_on: string | null;
  finished_on: string | null;
  created_at: string;
  updated_at: string;
};

export type MangaTracking = {
  entry_id: string;
  mangadex_id: string;
  language: string;
  notify: boolean;
  last_chapter_id: string | null;
  last_chapter_number: string | null;
  last_readable_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ChapterEvent = {
  id: string;
  entry_id: string;
  mangadex_chapter_id: string;
  chapter_number: string | null;
  volume: string | null;
  chapter_title: string | null;
  language: string;
  scanlation_group: string | null;
  readable_at: string;
  external_url: string | null;
  detected_at: string;
  notified_at: string | null;
  seen_at: string | null;
};

export type AppState = {
  id: number;
  last_visit_at: string | null;
  last_poll_at: string | null;
  last_poll_error: string | null;
  updated_at: string;
};

// Hilfstypen: beim Einfügen sind Spalten mit Default optional
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type Table<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: {
    foreignKeyName: string;
    columns: string[];
    isOneToOne: boolean;
    referencedRelation: string;
    referencedColumns: string[];
  }[];
};

export type Database = {
  public: {
    Tables: {
      library_entries: Table<
        LibraryEntry,
        Optional<
          LibraryEntry,
          | "id"
          | "title_alt"
          | "cover_url"
          | "release_year"
          | "total_units"
          | "status"
          | "progress"
          | "progress_season"
          | "rating"
          | "notes"
          | "started_on"
          | "finished_on"
          | "created_at"
          | "updated_at"
        >
      >;
      manga_tracking: Table<
        MangaTracking,
        Optional<
          MangaTracking,
          | "language"
          | "notify"
          | "last_chapter_id"
          | "last_chapter_number"
          | "last_readable_at"
          | "last_checked_at"
          | "last_error"
          | "created_at"
          | "updated_at"
        >
      >;
      chapter_events: Table<
        ChapterEvent,
        Optional<
          ChapterEvent,
          | "id"
          | "chapter_number"
          | "volume"
          | "chapter_title"
          | "scanlation_group"
          | "external_url"
          | "detected_at"
          | "notified_at"
          | "seen_at"
        >
      >;
      app_state: Table<
        AppState,
        Optional<AppState, "id" | "last_visit_at" | "last_poll_at" | "last_poll_error" | "updated_at">
      >;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
