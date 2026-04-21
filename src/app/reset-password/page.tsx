import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthShell } from "@/components/layout/AuthShell";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AuthShell
      title="Nueva contraseña"
      subtitle="Elegí una contraseña personal. No vas a poder volver a usar la temporal."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
