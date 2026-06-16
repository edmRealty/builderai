"use client";

import * as React from "react";

import { completeMfaSetup } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { ok: false; error: string } | { ok: true } | null;

export function MfaSetupForm() {
  const [state, formAction, isPending] = React.useActionState<State, FormData>(
    async (_prev, formData) => {
      return (await completeMfaSetup(formData)) as any;
    },
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium">6-digit code</label>
        <Input name="token" inputMode="numeric" pattern="[0-9]*" placeholder="123456" required />
      </div>

      {state && "error" in state ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Verifying…" : "Enable MFA"}
      </Button>
    </form>
  );
}
