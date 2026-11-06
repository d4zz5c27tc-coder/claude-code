"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  // Nach dem Login zurück zur ursprünglich aufgerufenen Seite
  const next = useSearchParams().get("next") ?? "/";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password" className="text-sm text-muted">
        Passwort
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
      />
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-accent px-3 py-2 font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Prüfe…" : "Anmelden"}
      </button>
    </form>
  );
}
