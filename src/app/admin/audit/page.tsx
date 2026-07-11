import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  // El layout de /admin ya redirige si no hay sesión ACTIVE con rol ADMIN; requireAdmin()
  // agrega una segunda capa defensiva puntual sobre esta página.
  const { error } = await requireAdmin();
  if (error) redirect("/login");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { email: true } } },
  });

  return (
    <>
      <PageHeader eyebrow="admin · auditoría" title="Auditoría" description="Últimos 100 registros de actividad administrativa, más recientes primero." />
      <div className="panel p-0 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-5 py-3">Fecha</th>
              <th className="px-3 py-3">Actor</th>
              <th className="px-3 py-3">Acción</th>
              <th className="px-5 py-3">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const detailParts = [
                log.subjectId ? `id: ${log.subjectId}` : null,
                log.metadata ? JSON.stringify(log.metadata) : null,
              ].filter(Boolean);
              return (
                <tr key={log.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="px-3 py-3">{log.actor?.email ?? "sistema"}</td>
                  <td className="px-3 py-3 mono text-xs">{log.action}</td>
                  <td className="px-5 py-3 text-muted-foreground text-xs truncate max-w-[420px]" title={detailParts.join(" · ") || undefined}>
                    {detailParts.length > 0 ? detailParts.join(" · ") : "—"}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">Sin registros.</td></tr>
            )}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
