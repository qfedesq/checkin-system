import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthShell } from "@/components/layout/AuthShell";
import { EnrollButton } from "./EnrollButton";

export default async function SetupBiometricsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.status !== "ACTIVE") redirect("/pending");

  return (
    <AuthShell
      title="Registrá tu dispositivo"
      subtitle="Vamos a asociar este dispositivo a tu cuenta usando su biometría (Face ID, Touch ID o Windows Hello). Desde ahora la vas a usar para fichar (check-in/out) desde este dispositivo; el ingreso a la cuenta sigue siendo con email y contraseña."
    >
      <EnrollButton hasWebauthn={session.user.hasWebauthn} />
    </AuthShell>
  );
}
