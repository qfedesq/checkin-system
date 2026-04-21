import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/utils";
import { Download, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const TYPE_LABEL = { PAYSLIP: "Recibo de sueldo", INTERNAL_DOC: "Documento interno", OTHER: "Otro" } as const;

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user) return null;
  const deliveries = await prisma.deliveredDocument.findMany({
    where: { recipientId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader eyebrow="recibidos" title="Documentos para vos" description="Hacé click para descargar. Al abrirlo, se firma automáticamente con tu firma digital." />
      <section className="panel p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-5 py-3">Documento</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">Enviado</th>
              <th className="px-3 py-3">Firmado</th>
              <th className="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id} className="border-b border-white/5 last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {d.title}
                  </div>
                </td>
                <td className="px-3 py-3">{TYPE_LABEL[d.type]}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</td>
                <td className="px-3 py-3 text-xs">
                  {d.openedAt ? <span className="badge-success">firmado {formatDateTime(d.openedAt)}</span> : <span className="badge-accent">sin abrir</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  <a className="btn-primary" href={`/api/deliveries/${d.id}/open`} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4" /> {d.openedAt ? "Descargar firmado" : "Descargar y firmar"}
                  </a>
                </td>
              </tr>
            ))}
            {deliveries.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No tenés documentos para abrir.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
