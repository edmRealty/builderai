"use client";

import * as React from "react";
import Link from "next/link";

import { verifyMfaToken } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { ok: false; error: string } | { ok: true } | null;

export function MfaVerifyForm() {
  const [state, formAction, isPending] = React.useActionState<State, FormData>(
    async (_prev, formData) => {
      return (await verifyMfaToken(formData)) as any;
    },
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium">Authentication code</label>
        <Input name="token" inputMode="numeric" pattern="[0-9]*" placeholder="123456" required />
        <p className="text-xs text-fg/60">
          Use the current code from your authenticator app. If you don’t have it set up yet, open{" "}
          <Link className="underline" href="/mfa/setup">
            /mfa/setup
          </Link>
          .
        </p>
      </div>

      {state && "error" in state ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Verifying…" : "Verify"}
      </Button>
    </form>
  );
}
