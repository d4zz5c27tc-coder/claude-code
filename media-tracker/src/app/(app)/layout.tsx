import Link from "next/link";
import { logout } from "../login/actions";

/** Rahmen für alle Seiten hinter dem Login (Route Group "(app)" taucht nicht in der URL auf). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/" className="font-semibold">
            Media-Tracker
          </Link>
          {/* Weitere Menüpunkte (Suche, Bibliothek, Neu) folgen in den nächsten Schritten */}
          <form action={logout} className="ml-auto">
            <button type="submit" className="text-sm text-muted hover:text-foreground">
              Abmelden
            </button>
          </form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
