"use client";

import * as React from "react";

import { startLogin } from "@/lib/actions/start-login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { ok: false; error: string } | { ok: true } | null;

export function LoginForm({ showDemoOneClick: _showDemoOneClick }: { showDemoOneClick?: boolean }) {
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

      <div className="border-t border-border pt-3 text-xs text-fg/60">
        Demo admin: demo-admin@mfcms.local / Password123!
      </div>
    </div>
  );
}
