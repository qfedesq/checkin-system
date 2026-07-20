import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/utils";
import { FileText } from "lucide-react";
import { MarkSeen } from "./MarkSeen";
import { OpenDelivery } from "./OpenDelivery";

export const dynamic = "force-dynamic";

const TYPE_LABEL = { PAYSLIP: "Recibo de sueldo", INTERNAL_DOC: "Notificación", OTHER: "Otro" } as const;

const TABS = [
  { key: "", label: "Todos" },
  { key: "PAYSLIP", label: "Recibos" },
  { key: "INTERNAL_DOC", label: "Notificaciones" },
] as const;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ type?: string; month?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const sp = await searchParams;
  const type = sp.type === "PAYSLIP" || sp.type === "INTERNAL_DOC" ? sp.type : "";
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : "";

  let monthFilter = {};
  if (month) {
    const [y, m] = month.split("-").map(Number);
    monthFilter = { createdAt: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } };
  }

  const deliveries = await prisma.deliveredDocument.findMany({
    where: {
      recipientId: session.user.id,
      ...(type ? { type } : {}),
      ...monthFilter,
    },
    orderBy: { createdAt: "desc" },
  });


  const qs = (t: string, m: string) => {
    const p = new URLSearchParams();
    if (t) p.set("type", t);
    if (m) p.set("month", m);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <MarkSeen />
      <PageHeader eyebrow="recibidos" title="Documentos para vos" description="Hacé click para descargar. Al abrirlo, se firma automáticamente con tu firma digital." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <Link key={t.key} href={`/inbox${qs(t.key, month)}`} role="tab" aria-selected={type === t.key} className={type === t.key ? "btn-primary" : "btn-ghost"}>
              {t.label}
            </Link>
          ))}
        </div>
        <form action="/inbox" method="get" className="ml-auto flex items-center gap-2">
          {type && <input type="hidden" name="type" value={type} />}
          <input type="month" name="month" defaultValue={month} className="surface-control" />
          <button className="btn-ghost" type="submit">Filtrar</button>
          {month && <Link href={`/inbox${qs(type, "")}`} className="btn-ghost text-xs">Limpiar</Link>}
        </form>
      </div>

      <section className="panel p-0 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-5 py-3">Documento</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">Recibido</th>
              <th className="px-3 py-3">Firmado</th>
              <th className="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {d.title}
                  </div>
                </td>
                <td className="px-3 py-3">{TYPE_LABEL[d.type]}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</td>
                <td className="px-3 py-3 text-xs">
                  {d.openedAt ? (
                    <div className="flex flex-col gap-1">
                      <span className="badge-success w-fit">Firmado</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(d.openedAt)}</span>
                    </div>
                  ) : (
                    <span className="badge-warning">sin abrir</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <OpenDelivery id={d.id} opened={Boolean(d.openedAt)} />
                </td>
              </tr>
            ))}
            {deliveries.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                {type || month ? "No hay documentos con ese filtro." : "No tenés documentos para abrir."}
              </td></tr>
            )}
          </tbody>
        </table></div>
      </section>
    </>
  );
}
