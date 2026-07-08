import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEmployeeProfileComplete } from "@/lib/profile";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePassword) redirect("/reset-password");
  if (session.user.role === "ADMIN") redirect("/admin");

  // Usuario nuevo: si todavía no completó sus datos personales, lo mandamos directo al perfil.
  const profile = await prisma.employeeProfile.findUnique({ where: { userId: session.user.id } });
  if (!isEmployeeProfileComplete(profile)) redirect("/profile");

  redirect("/dashboard");
}
