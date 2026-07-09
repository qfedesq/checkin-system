import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // El JWT no se revoca al deshabilitar la cuenta o cambiar el rol: se revalida contra la DB en cada carga.
  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { status: true, role: true } });
  if (!currentUser || currentUser.status !== "ACTIVE") redirect("/login");
  if (currentUser.role === "ADMIN") redirect("/admin");

  return (
    <AppShell role="EMPLOYEE" userName={session.user.name ?? session.user.email}>
      {children}
    </AppShell>
  );
}
