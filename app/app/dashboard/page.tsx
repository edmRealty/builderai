import Link from "next/link";
import { DrawStatus, Role } from "@prisma/client";
import {
  Banknote,
  ClipboardList,
  HardHat,
  Radio,
  UserRound,
  Users
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectScopeWhere } from "@/lib/scope";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createOrgTodo, toggleOrgTodoCompleted } from "@/lib/actions/org-todos";
import { SyncIntegrationsCard } from "@/components/dashboard/sync-integrations";
import { LiveDashboardRefresh } from "./live-dashboard-refresh";

export const dynamic = "force-dynamic";

type ActivitySource = "FIELD" | "OFFICE" | "OWNER" | "BANKER" | "SYSTEM";

type ActivityItem = {
  id: string;
  at: Date;
  actor: string;
  source: ActivitySource;
  title: string;
  detail: string;
  href: string;
};

const sourceMeta: Record<ActivitySource, { label: string; dot: string; badge: string; icon: typeof HardHat }> = {
  FIELD: {
    label: "Field managers",
    dot: "bg-emerald-500",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: HardHat
  },
  OFFICE: {
    label: "Office staff",
    dot: "bg-sky-500",
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    icon: ClipboardList
  },
  OWNER: {
    label: "Owners",
    dot: "bg-violet-500",
    badge: "border-violet-200 bg-violet-50 text-violet-800",
    icon: UserRound
  },
  BANKER: {
    label: "Bankers",
    dot: "bg-amber-500",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Banknote
  },
  SYSTEM: {
    label: "System",
    dot: "bg-slate-500",
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    icon: Radio
  }
};

function sourceFromRole(role: Role): ActivitySource {
  if (role === Role.FIELD_AGENT) return "FIELD";
  if (role === Role.BANKER) return "BANKER";
  if (role === Role.OWNER) return "OWNER";
  return "OFFICE";
}

function actorLabel(user: { name: string | null; email: string; role: Role }) {
  return user.name ?? user.email;
}

function trimText(value: string | null | undefined, length = 150) {
  if (!value) return "No note added.";
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function communicationLabel(type: string) {
  if (type === "CALL") return "Call logged";
  if (type === "TEXT") return "Text logged";
  if (type === "EMAIL") return "Email logged";
  return "Communication logged";
}

function drawStatusLabel(status: DrawStatus) {
  const labels: Record<DrawStatus, string> = {
    DRAFT: "Draft draw updated",
    READY_FOR_BANK_REVIEW: "Draw sent to bank",
    NEEDS_INFO: "Bank requested more info",
    REJECTED: "Draw rejected",
    APPROVED: "Draw approved",
    FUNDED: "Draw funded"
  };
  return labels[status];
}

function drawSource(status: DrawStatus): ActivitySource {
  if (status === DrawStatus.APPROVED || status === DrawStatus.NEEDS_INFO || status === DrawStatus.REJECTED || status === DrawStatus.FUNDED) {
    return "BANKER";
  }
  return "OFFICE";
}

function shortDateTime(date: Date) {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function shortDueDate(date: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const projectWhere = projectScopeWhere(user);
  const scopedProjects = await prisma.project.findMany({
    where: projectWhere,
    select: { id: true }
  });
  const scopedProjectIds = scopedProjects.map((project) => project.id);
  const now = new Date();
  const recentSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    commitmentAgg,
    openCommitments,
    expiringPermits,
    drawPipeline,
    forSaleCount,
    rentalReadyCount,
    forRentUnitCount,
    occupiedUnitCount,
    todos,
    openOrgTodoCount,
    recentProjectUpdates,
    recentReminders,
    recentVendorCommunications,
    recentBankCommunications,
    recentDrawRequests,
    fieldUpdates24h,
    remindersDueSoon
  ] = await Promise.all([
    prisma.commitment.aggregate({
      where: { project: projectWhere },
      _sum: { agreedCents: true, paidToDateCents: true }
    }),
    prisma.commitment.count({ where: { project: projectWhere, status: { not: "PAID" } } }),
    prisma.permit.count({
      where: {
        project: projectWhere,
        expiresAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      }
    }),
    prisma.drawRequest.groupBy({
      by: ["status"],
      where: { projectId: { in: scopedProjectIds } },
      _count: { _all: true }
    }),
    prisma.project.count({ where: { ...projectWhere, status: { in: ["COMPLETED_FOR_SALE", "COMPLETED", "FOR_SALE"] } } }),
    prisma.project.count({ where: { ...projectWhere, status: { in: ["COMPLETED_FOR_RENT", "RENTAL_READY"] } } }),
    prisma.unit.count({ where: { project: { ...projectWhere, status: { in: ["COMPLETED_FOR_RENT", "RENTAL_READY"] } }, rentalStatus: "AVAILABLE" } }),
    prisma.unit.count({ where: { project: { ...projectWhere, status: { in: ["COMPLETED_FOR_RENT", "RENTAL_READY"] } }, rentalStatus: "OCCUPIED" } }),
    prisma.orgTodo.findMany({
      where: { orgId: user.orgId, completedAt: null },
      include: { createdBy: true },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 15
    }),
    prisma.orgTodo.count({
      where: { orgId: user.orgId, completedAt: null }
    }),
    prisma.projectUpdate.findMany({
      where: {
        orgId: user.orgId,
        projectId: { in: scopedProjectIds },
        createdAt: { gte: recentSince }
      },
      include: {
        project: { select: { id: true, name: true } },
        author: { select: { email: true, name: true, role: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 14
    }),
    prisma.reminder.findMany({
      where: {
        orgId: user.orgId,
        projectId: { in: scopedProjectIds },
        createdAt: { gte: recentSince }
      },
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { email: true, name: true, role: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    prisma.vendorCommunication.findMany({
      where: {
        orgId: user.orgId,
        projectId: { in: scopedProjectIds },
        createdAt: { gte: recentSince }
      },
      include: {
        project: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true, expertise: true } },
        createdBy: { select: { email: true, name: true, role: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    prisma.bankCommunication.findMany({
      where: {
        orgId: user.orgId,
        projectId: { in: scopedProjectIds },
        createdAt: { gte: recentSince }
      },
      include: {
        project: { select: { id: true, name: true } },
        bank: { select: { id: true, name: true } },
        createdBy: { select: { email: true, name: true, role: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    prisma.drawRequest.findMany({
      where: {
        orgId: user.orgId,
        projectId: { in: scopedProjectIds },
        updatedAt: { gte: recentSince }
      },
      include: {
        project: { select: { id: true, name: true } },
        loan: {
          select: {
            name: true,
            bank: { select: { name: true } }
          }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 12
    }),
    prisma.projectUpdate.count({
      where: {
        orgId: user.orgId,
        projectId: { in: scopedProjectIds },
        createdAt: { gte: last24Hours },
        author: { role: Role.FIELD_AGENT }
      }
    }),
    prisma.reminder.count({
      where: {
        orgId: user.orgId,
        projectId: { in: scopedProjectIds },
        completedAt: null,
        dueAt: { lte: nextSevenDays }
      }
    })
  ]);

  const totalCommitted = commitmentAgg._sum.agreedCents ?? 0;
  const totalPaid = commitmentAgg._sum.paidToDateCents ?? 0;

  const pipelineMap = new Map(drawPipeline.map((d) => [d.status, d._count._all]));
  const projectCount = scopedProjectIds.length;
  const readyForBank = pipelineMap.get("READY_FOR_BANK_REVIEW") ?? 0;
  const bankNeedsInfo = pipelineMap.get("NEEDS_INFO") ?? 0;
  const approvedNotFunded = pipelineMap.get("APPROVED") ?? 0;
  const today = now;
  const todayLabel = today.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "2-digit" });

  const allActivities: ActivityItem[] = [
    ...recentProjectUpdates.map((update) => ({
      id: `project-update-${update.id}`,
      at: update.createdAt,
      actor: actorLabel(update.author),
      source: sourceFromRole(update.author.role),
      title: `${update.project.name} update`,
      detail: trimText(update.body),
      href: `/app/projects/${update.project.id}`
    })),
    ...recentReminders.map((reminder) => {
      const due = shortDueDate(reminder.dueAt);
      return {
        id: `reminder-${reminder.id}`,
        at: reminder.createdAt,
        actor: actorLabel(reminder.createdBy),
        source: sourceFromRole(reminder.createdBy.role),
        title: `${reminder.project.name} reminder`,
        detail: `${trimText(reminder.body, 120)}${due ? ` Due ${due}.` : ""}`,
        href: `/app/projects/${reminder.project.id}`
      };
    }),
    ...recentVendorCommunications.map((communication) => ({
      id: `vendor-communication-${communication.id}`,
      at: communication.createdAt,
      actor: actorLabel(communication.createdBy),
      source: sourceFromRole(communication.createdBy.role),
      title: `${communicationLabel(communication.type)} with ${communication.vendor.name}`,
      detail: `${communication.project?.name ?? "Portfolio"}${communication.vendor.expertise ? ` - ${communication.vendor.expertise}` : ""}. ${trimText(communication.note, 110)}`,
      href: communication.project ? `/app/projects/${communication.project.id}` : `/app/vendors/${communication.vendor.id}`
    })),
    ...recentBankCommunications.map((communication) => ({
      id: `bank-communication-${communication.id}`,
      at: communication.createdAt,
      actor: actorLabel(communication.createdBy),
      source: sourceFromRole(communication.createdBy.role),
      title: `${communicationLabel(communication.type)} with ${communication.bank.name}`,
      detail: `${communication.project?.name ?? "Portfolio"}. ${trimText(communication.note, 120)}`,
      href: communication.project ? `/app/projects/${communication.project.id}` : `/app/banks/${communication.bank.id}`
    })),
    ...recentDrawRequests.map((draw) => ({
      id: `draw-${draw.id}`,
      at: draw.updatedAt,
      actor: drawSource(draw.status) === "BANKER" ? draw.loan.bank.name : "Office team",
      source: drawSource(draw.status),
      title: drawStatusLabel(draw.status),
      detail: `${draw.project.name} - ${draw.loan.bank.name}${draw.loan.name ? `, ${draw.loan.name}` : ""}`,
      href: `/app/projects/${draw.project.id}/draws/${draw.id}`
    })),
    ...todos.map((todo) => {
      const due = shortDueDate(todo.dueAt);
      return {
        id: `org-todo-${todo.id}`,
        at: todo.dueAt ?? todo.createdAt,
        actor: actorLabel(todo.createdBy),
        source: sourceFromRole(todo.createdBy.role),
        title: "Org task",
        detail: `${trimText(todo.body, 120)}${due ? ` Due ${due}.` : ""}`,
        href: "/app/dashboard#org-todos"
      };
    })
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const liveActivities = allActivities.slice(0, 12);
  const sourceLanes = (["FIELD", "OFFICE", "OWNER", "BANKER"] as ActivitySource[]).map((source) => ({
    source,
    items: allActivities.filter((activity) => activity.source === source).slice(0, 3)
  }));

  const commandSignals = [
    { label: "Field updates 24h", value: fieldUpdates24h, href: "/app/projects", tone: "text-emerald-700" },
    { label: "Bank needs info", value: bankNeedsInfo, href: "/app/reports#draw-pipeline", tone: "text-amber-700" },
    { label: "Ready for banker", value: readyForBank, href: "/app/reports#draw-pipeline", tone: "text-sky-700" },
    { label: "Due this week", value: remindersDueSoon + openOrgTodoCount, href: "/app/dashboard#org-todos", tone: "text-violet-700" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Portfolio Dashboard</h1>
          <p className="text-sm text-fg/70">Today: {todayLabel} • Live snapshot across your accessible projects.</p>
        </div>
        <LiveDashboardRefresh refreshedAt={now.toISOString()} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/app/projects">
          <Card className="hover:bg-muted/40">
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{projectCount}</div>
              <div className="text-sm text-fg/70">View all projects</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/reports#portfolio-kpis">
          <Card className="hover:bg-muted/40">
            <CardHeader>
              <CardTitle>Total committed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatMoney(totalCommitted)}</div>
              <div className="text-sm text-fg/70">Breakdown by project/vendor</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/reports#portfolio-kpis">
          <Card className="hover:bg-muted/40">
            <CardHeader>
              <CardTitle>Paid to date</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatMoney(totalPaid)}</div>
              <div className="text-sm text-fg/70">Breakdown + export</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/app/projects?status=COMPLETED_FOR_RENT">
          <Card className="hover:bg-muted/40">
            <CardHeader>
              <CardTitle>Active rentals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{rentalReadyCount}</div>
              <div className="text-sm text-fg/70">{occupiedUnitCount} occupied units</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/projects?status=COMPLETED_FOR_SALE">
          <Card className="hover:bg-muted/40">
            <CardHeader>
              <CardTitle>For sale properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{forSaleCount}</div>
              <div className="text-sm text-fg/70">Ready to list</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/projects?status=COMPLETED_FOR_RENT">
          <Card className="hover:bg-muted/40">
            <CardHeader>
              <CardTitle>For rent units</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{forRentUnitCount}</div>
              <div className="text-sm text-fg/70">Available units</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Live Command Center</CardTitle>
              <div className="text-xs text-fg/60">Tasks and updates from field, office, owners, and bankers.</div>
            </div>
            <Radio className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              {commandSignals.map((signal) => (
                <Link key={signal.label} href={signal.href} className="rounded-lg border border-border bg-muted/30 px-3 py-2 hover:bg-muted/60">
                  <div className={`text-xl font-semibold ${signal.tone}`}>{signal.value}</div>
                  <div className="text-xs text-fg/65">{signal.label}</div>
                </Link>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              {sourceLanes.map((lane) => {
                const meta = sourceMeta[lane.source];
                const Icon = meta.icon;

                return (
                  <div key={lane.source} className="rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${meta.badge}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="text-sm font-semibold">{meta.label}</div>
                          <div className="text-xs text-fg/55">Incoming tasks</div>
                        </div>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                    </div>

                    <div className="space-y-2 p-3">
                      {lane.items.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-fg/55">
                          No current tasks from this source.
                        </div>
                      ) : (
                        lane.items.map((item) => (
                          <Link key={item.id} href={item.href} className="block rounded-md bg-muted/45 px-3 py-2 hover:bg-muted">
                            <div className="truncate text-sm font-medium">{item.title}</div>
                            <div className="mt-1 line-clamp-2 text-xs text-fg/65">{item.detail}</div>
                            <div className="mt-2 text-[11px] text-fg/45">
                              {item.actor} • {shortDateTime(item.at)}
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {liveActivities.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-sm text-fg/60">
                No live activity yet. Tasks, field updates, CRM touches, reminders, and draw changes will appear here.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                <div className="flex items-center justify-between bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg/55">
                  <span>Latest cross-source feed</span>
                  <span>{liveActivities.length} items</span>
                </div>
                {liveActivities.map((activity) => {
                  const meta = sourceMeta[activity.source];
                  const Icon = meta.icon;

                  return (
                    <Link key={activity.id} href={activity.href} className="flex gap-3 px-3 py-3 text-sm hover:bg-muted/50">
                      <span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.badge}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{activity.title}</span>
                          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                          <span className="text-xs text-fg/55">{meta.label}</span>
                        </span>
                        <span className="mt-1 block text-fg/70">{activity.detail}</span>
                        <span className="mt-1 block text-xs text-fg/50">
                          {activity.actor} • {shortDateTime(activity.at)}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Draft draws</span>
              <Link className="underline" href="/app/reports#draw-pipeline">{pipelineMap.get("DRAFT") ?? 0}</Link>
            </div>
            <div className="flex justify-between">
              <span>Ready for banker</span>
              <Link className="underline" href="/app/reports#draw-pipeline">{readyForBank}</Link>
            </div>
            <div className="flex justify-between">
              <span>Approved not funded</span>
              <Link className="underline" href="/app/reports#draw-pipeline">{approvedNotFunded}</Link>
            </div>
            <div className="flex justify-between">
              <span>Needs info</span>
              <Link className="underline" href="/app/reports#draw-pipeline">{bankNeedsInfo}</Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Open commitments</span>
              <Link className="underline" href="/app/reports#commitment-summary">{openCommitments}</Link>
            </div>
            <div className="flex justify-between">
              <span>Permits expiring (30d)</span>
              <Link className="underline" href="/app/reports#expirations">{expiringPermits}</Link>
            </div>
            <div className="text-xs text-fg/60">More alerts appear as you add abatements, inspections, and exceptions.</div>
          </CardContent>
        </Card>
      </div>

      <SyncIntegrationsCard />

      <Card id="org-todos">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>To‑do (org)</CardTitle>
            <div className="flex items-center gap-2 text-xs text-fg/60">
              <Users className="h-4 w-4" />
              {openOrgTodoCount} open
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {user.role !== "BANKER" ? (
            <form action={createOrgTodo} className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
              <Input name="body" placeholder="Add a task…" required />
              <Input name="dueAt" type="date" />
              <Button type="submit">Add</Button>
            </form>
          ) : (
            <div className="text-sm text-fg/70">Banker accounts are read-only for to-dos.</div>
          )}

          {todos.length === 0 ? (
            <div className="text-sm text-fg/70">No open tasks.</div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {todos.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm odd:bg-muted/60 even:bg-card">
                  <div>
                    <div className="font-medium">{t.body}</div>
                    <div className="text-xs text-fg/60">
                      {t.dueAt ? `Due ${t.dueAt.toLocaleDateString()} • ` : ""}By {t.createdBy.name ?? t.createdBy.email}
                    </div>
                  </div>
                  {user.role !== "BANKER" ? (
                    <form action={toggleOrgTodoCompleted}>
                      <input type="hidden" name="todoId" value={t.id} />
                      <Button size="sm" variant="secondary" type="submit">Mark done</Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
