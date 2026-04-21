import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePassword) redirect("/reset-password");
  if (session.user.role === "ADMIN") redirect("/admin");
  redirect("/dashboard");
}
