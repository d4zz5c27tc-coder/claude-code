import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Media-Tracker", template: "%s · Media-Tracker" },
  description: "Persönlicher Tracker für Anime, Manga, Filme und Serien",
  // Private App: nicht in Suchmaschinen aufnehmen
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
