"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { createBank } from "@/lib/actions/banks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProjectOption = {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
};

type Props = {
  projects: ProjectOption[];
};

export function AddBankPanel({ projects }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button type="button" onClick={() => setOpen(true)}>Add Bank</Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(820px,calc(100vw-2rem))] rounded-md border border-border bg-card p-3 shadow">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="font-medium">Add bank</div>
            <button
              aria-label="Close add bank window"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-fg hover:bg-border"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form action={createBank} className="space-y-3">
            <Input name="name" placeholder="Bank name" required />
            <div className="grid gap-3 md:grid-cols-2">
              <Input name="contactName" placeholder="Contact name" />
              <Input name="contactEmail" type="email" placeholder="Contact email" />
            </div>
            <Input name="contactPhone" placeholder="Contact phone" />

            <select
              name="projectId"
              className="h-11 w-full rounded-xl border border-border bg-bg px-4 py-2 text-sm text-fg shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <option value="">Link to a Project (optional)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} - {project.addressLine1}, {project.city}, {project.state} {project.zip}
                </option>
              ))}
            </select>

            <div className="grid gap-3 md:grid-cols-2">
              <Input name="loanName" placeholder="Loan name (optional)" />
              <Input name="loanNumber" placeholder="Loan number (optional)" />
              <Input name="totalLoan" inputMode="decimal" placeholder="Total loan amount (optional)" />
              <Input name="paidToDate" inputMode="decimal" placeholder="Paid to date (optional)" />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Create bank</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
