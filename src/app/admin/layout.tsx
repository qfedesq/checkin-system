import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [pendingUsers, pendingLeaves, pendingDocs] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.documentUpload.count({ where: { status: "PENDING_REVIEW" } }),
  ]);

  return (
    <AppShell
      role="ADMIN"
      userName={session.user.name ?? session.user.email}
      adminBadges={{
        "/admin/users": pendingUsers,
        "/admin/leaves": pendingLeaves,
        "/admin/documents": pendingDocs,
      }}
    >
      {children}
    </AppShell>
  );
}
