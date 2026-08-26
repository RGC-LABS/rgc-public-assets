"use client";

import { useState } from "react";
import { Button, Eyebrow, Field, FieldError, FieldLabel, PasswordInput } from "@rgc-labs/ui";
import { Lock } from "lucide-react";

export default function LockPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const next = new URLSearchParams(window.location.search).get("next");
        window.location.replace(next && next.startsWith("/") ? next : "/");
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not verify that password.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-(--rgc-space-6)">
      <form
        onSubmit={submit}
        className="flex w-full max-w-96 flex-col gap-(--rgc-space-5) rounded-(--radius-surface) border border-border bg-surface-1 p-(--rgc-space-6)"
      >
        <div className="flex flex-col gap-(--rgc-space-2)">
          <Eyebrow>RGC LABS</Eyebrow>
          <h1 className="flex items-center gap-(--rgc-space-2) text-(length:--rgc-text-title) text-fg">
            <Lock className="size-icon-sm text-fg-muted" aria-hidden />
            Asset Library
          </h1>
          <p className="text-(length:--rgc-text-ui) text-fg-muted">
            This browser is private. Enter the password to continue.
          </p>
        </div>

        <Field name="password">
          <FieldLabel>Password</FieldLabel>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            aria-label="Password"
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>

        <Button type="submit" variant="primary" disabled={busy || password.length === 0}>
          {busy ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}
