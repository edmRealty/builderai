"use client";

import * as React from "react";

import { demoLoginAsDemoAdmin, devLoginAsDemo, startLogin } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { ok: false; error: string } | { ok: true } | null;

export function LoginForm({ showDemoOneClick }: { showDemoOneClick?: boolean }) {
  const [state, formAction, isPending] = React.useActionState<State, FormData>(
    async (_prevState, formData) => {
      return (await startLogin(formData)) as any;
    },
    null
  );

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <Input name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Password</label>
          <Input name="password" type="password" autoComplete="current-password" required />
        </div>

        {state && "error" in state ? (
          <p className="text-sm text-danger">{state.error}</p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {showDemoOneClick ? (
        <div className="border-t border-border pt-3">
          <form action={demoLoginAsDemoAdmin}>
            <Button variant="secondary" type="submit" className="w-full">
              Demo: One‑click login
            </Button>
          </form>
          <div className="mt-2 text-xs text-fg/60">
            Uses `demo-admin@mfcms.local` (created by demo seed).
          </div>
        </div>
      ) : null}

      {process.env.NODE_ENV !== "production" ? (
        <div className="border-t border-border pt-3">
          <form action={devLoginAsDemo}>
            <Button variant="secondary" type="submit" className="w-full">
              Dev: Login as demo admin
            </Button>
          </form>
          <div className="mt-2 text-xs text-fg/60">
            Uses `demo-admin@mfcms.local` (created by `npm run db:seed`).
          </div>
        </div>
      ) : null}
    </div>
  );
}
