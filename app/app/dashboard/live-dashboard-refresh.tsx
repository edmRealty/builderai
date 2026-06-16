"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  refreshedAt: string;
};

export function LiveDashboardRefresh({ refreshedAt }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const refreshedDate = new Date(refreshedAt);

  useEffect(() => {
    const timer = window.setInterval(() => {
      startTransition(() => router.refresh());
    }, 30000);

    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-fg/60">
      <span>Auto-refresh every 30s</span>
      <span className="hidden sm:inline">Last updated {refreshedDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-8 rounded-lg px-2"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
        title="Refresh dashboard"
        aria-label="Refresh dashboard"
      >
        <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
        <span className="sr-only">Refresh</span>
      </Button>
    </div>
  );
}
