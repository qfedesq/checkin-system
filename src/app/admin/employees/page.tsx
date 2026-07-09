import Link from "next/link";
import { ChevronRight, UserCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { fileUrl } from "@/lib/file-token";

export const dynamic = "force-dynamic";

export default async function AdminEmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const users = await prisma.user.findMany({
    where: {
      role: "EMPLOYEE",
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { profile: { lastName: { contains: query, mode: "insensitive" } } },
              { profile: { firstName: { contains: query, mode: "insensitive" } } },
              { profile: { legajo: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { profile: true },
  });

  // Alfabético por apellido (los sin perfil van al final)
  const sorted = users.sort((a, b) => {
    const la = a.profile?.lastName?.trim() || "￿";
    const lb = b.profile?.lastName?.trim() || "￿";
    return la.localeCompare(lb, "es") || (a.profile?.firstName ?? "").localeCompare(b.profile?.firstName ?? "", "es");
  });

  return (
    <>
      <PageHeader eyebrow="admin · empleados" title="Empleados" description="Listado alfabético por apellido. Entrá a la ficha para ver y editar todos los datos." />

      <form className="panel mb-6 p-4" action="/admin/employees" method="get">
        <div className="flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Buscar por apellido, nombre, legajo o email…"
            className="surface-control flex-1"
          />
          <button className="btn-primary" type="submit">Buscar</button>
        </div>
      </form>

      <section className="panel overflow-hidden p-0">
        <ul className="divide-y divide-border/60">
          {sorted.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/employees/${u.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-secondary/60">
                {u.profile?.faceImageBlobUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(u.profile.faceImageBlobUrl)} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <UserCircle className="h-10 w-10 shrink-0 text-muted-foreground/50" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {u.profile ? `${u.profile.lastName}, ${u.profile.firstName}` : u.email}
                  </div>
                  <div className="mono truncate text-xs text-muted-foreground">
                    {u.profile?.legajo ? `Legajo ${u.profile.legajo} · ` : ""}
                    {u.profile?.category === "DRIVER" ? "Chofer" : u.profile?.category === "HELPER" ? "Ayudante" : "Sin perfil"}
                    {u.status === "DISABLED" ? " · BLOQUEADO" : ""}
                  </div>
                </div>
                {u.status === "DISABLED" && <span className="badge-danger shrink-0">bloqueado</span>}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
          {sorted.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-muted-foreground">No se encontraron empleados.</li>
          )}
        </ul>
      </section>
    </>
  );
}
