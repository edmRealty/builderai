import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

const primaryNavItems = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/projects", label: "Projects" },
  { href: "/app/llcs", label: "Corp" },
  { href: "/app/vendors", label: "Vendors" },
  { href: "/app/banks", label: "Banks" }
];

const footerNavItems = [
  { href: "/app/master-sheet", label: "Export/Import" },
  { href: "/app/users", label: "Users" },
  { href: "/app/reports", label: "Reports" },
  { href: "/app/notifications", label: "Notifications" }
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/app/dashboard" className="font-semibold">
              General Contractor
            </Link>
            <nav className="hidden gap-3 md:flex">
              {primaryNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-2 py-1 text-sm text-fg/80 hover:bg-muted/60 hover:text-fg"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium">{user.email}</div>
              <div className="text-xs text-fg/70">{user.role.replaceAll("_", " ")}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl p-6">{children}</main>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-10 pt-2 text-sm">
        <div className="grid gap-6 rounded-xl border border-border bg-card/60 p-5 shadow-soft md:grid-cols-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-fg/60">Shortcuts</div>
            <div className="mt-3 grid gap-2">
              <Link className="text-fg/80 hover:text-fg" href="/app/tools/property-tax">
                Property Tax
              </Link>
              <Link className="text-fg/80 hover:text-fg" href="/app/tools/property-value-tracker">
                Property Value Tracker
              </Link>
              <Link className="text-fg/80 hover:text-fg" href="/app/tools/tax-abatement">
                Tax Abatement
              </Link>
              <Link className="text-fg/80 hover:text-fg" href="/app/llcs">
                Create new LLC
              </Link>
              <Link className="text-fg/80 hover:text-fg" href="/app/banks">
                Create new bank account
              </Link>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-fg/60">Admin</div>
            <div className="mt-3 grid gap-2">
              {footerNavItems.map((item) => (
                <Link key={item.href} className="text-fg/80 hover:text-fg" href={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-fg/60">Notes</div>
            <div className="mt-3 text-fg/70">
              Add projects + vendors, then use Reports to export for banks and accounting.
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-fg/60">
          <div>© {new Date().getFullYear()} HousingPA</div>
          <div className="flex items-center gap-2">
            <Link className="hover:text-fg" href="/app/dashboard">
              Dashboard
            </Link>
            <span aria-hidden="true">•</span>
            <Link className="hover:text-fg" href="/app/tools">
              Tools
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
