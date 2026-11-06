import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-raised p-6">
        <h1 className="mb-1 text-xl font-semibold">Media-Tracker</h1>
        <p className="mb-6 text-sm text-muted">Bitte melde dich an.</p>
        {/* useSearchParams braucht eine Suspense-Grenze */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
