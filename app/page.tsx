import { redirect } from "next/navigation";

import SignInPage from "@/app/(public)/signin/page";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/app/dashboard");

  const orgCount = await prisma.organization.count();
  if (orgCount === 0) redirect("/setup");

  return <SignInPage />;
}
