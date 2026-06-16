"use client";

import { useState, useTransition } from "react";

import { updateProjectStatus } from "@/lib/actions/projects";
import { ACTIVE_PROJECT_STATUSES, projectStatusMeta, type ActiveProjectStatus } from "@/lib/project-status";
import { Button } from "@/components/ui/button";

type Prompt = {
  title: string;
  primary: string;
  secondary?: string;
};

type Props = {
  projectId: string;
  status: string;
  editable: boolean;
};

export function ProjectStatusBadge({ status }: { status: string }) {
  const meta = projectStatusMeta(status);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-fg/70">
      <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
      {meta.label}
    </span>
  );
}

export function ProjectStatusControl({ projectId, status, editable }: Props) {
  const initial = projectStatusMeta(status);
  const [currentStatus, setCurrentStatus] = useState<ActiveProjectStatus>(initial.value);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [pending, startTransition] = useTransition();
  const current = projectStatusMeta(currentStatus);

  if (!editable) return <ProjectStatusBadge status={currentStatus} />;

  function changeStatus(value: string) {
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("status", value);

    startTransition(async () => {
      const result = await updateProjectStatus(formData);
      setCurrentStatus(result.status);
      setPrompt(result.prompt ?? null);
    });
  }

  return (
    <div className="relative inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${current.dotClass}`} />
      <select
        aria-label="Change project status"
        className="h-9 rounded-md border border-border bg-bg px-2 text-xs text-fg shadow-sm disabled:opacity-60"
        disabled={pending}
        onChange={(event) => changeStatus(event.target.value)}
        value={currentStatus}
      >
        {ACTIVE_PROJECT_STATUSES.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      {prompt ? (
        <div className="absolute right-0 top-11 z-30 w-[min(320px,calc(100vw-2rem))] rounded-md border border-border bg-card p-3 text-sm shadow">
          <div className="font-medium">{prompt.title}</div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setPrompt(null)}>Not now</Button>
            {prompt.secondary ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => setPrompt(null)}>{prompt.secondary}</Button>
            ) : null}
            <Button type="button" size="sm" onClick={() => setPrompt(null)}>{prompt.primary}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
