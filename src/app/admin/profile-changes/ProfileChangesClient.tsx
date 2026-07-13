"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const FIELD_LABELS: Record<string, string> = {
  lastName: "Apellido",
  firstName: "Nombre",
  dob: "Fecha de nacimiento",
  category: "Categoría",
  phone: "Teléfono",
  professionalLicenseExpiry: "Venc. carnet profesional",
  healthCardExpiry: "Venc. libreta sanitaria",
  shirtSize: "Talle remera",
  hoodieSize: "Talle buzo",
  jacketSize: "Talle campera",
  pantsSize: "Talle pantalón",
  shoeSize: "Talle calzado",
  address: "Dirección",
  addressNumber: "Numeración",
  neighborhood: "Barrio",
  city: "Localidad",
  postalCode: "Código postal",
  emergencyContact: "Contacto de emergencia",
  emergencyPhone: "Tel. de emergencia",
  faceImageBlobUrl: "Foto de frente",
  signatureBlobUrl: "Firma",
  dniFrontBlobUrl: "DNI (frente)",
  dniBackBlobUrl: "DNI (dorso)",
  licenseFrontBlobUrl: "Carnet (frente)",
  licenseBackBlobUrl: "Carnet (dorso)",
  healthCardFrontBlobUrl: "Libreta (frente)",
  healthCardBackBlobUrl: "Libreta (dorso)",
};

// Los campos de imagen ya vienen con `from`/`to` proxeados por fileUrl desde el server.
type Change = { type: "text" | "image"; from: string; to: string };

type Row = {
  id: string;
  employee: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  changes: Record<string, Change>;
  note: string | null;
};

export function ProfileChangesClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Por solicitud, qué campos quedaron tildados para aprobar (por defecto, todos).
  const [approvedByRequest, setApprovedByRequest] = useState<Record<string, Record<string, boolean>>>({});

  function fieldsFor(r: Row): Record<string, boolean> {
    return approvedByRequest[r.id] ?? Object.fromEntries(Object.keys(r.changes).map((f) => [f, true]));
  }

  function toggleField(r: Row, field: string) {
    setApprovedByRequest((prev) => ({ ...prev, [r.id]: { ...fieldsFor(r), [field]: !fieldsFor(r)[field] } }));
  }

  async function reject(id: string) {
    const note = window.prompt("Motivo del rechazo (opcional):");
    if (note === null) return; // el admin canceló el prompt: no rechazar
    setBusy(id);
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/admin/profile-changes/${id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const out = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(out.error ?? "No pudimos procesar el cambio de perfil. Probá de nuevo.");
    setMsg("Cambio rechazado.");
    setTimeout(() => setMsg(null), 4000);
    router.refresh();
  }

  async function applyDecision(r: Row) {
    const approved = fieldsFor(r);
    const allFields = Object.keys(r.changes);
    const approvedFields = allFields.filter((f) => approved[f]);
    setBusy(r.id);
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/admin/profile-changes/${r.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approvedFields }),
    });
    const out = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(out.error ?? "No pudimos procesar el cambio de perfil. Probá de nuevo.");
    setMsg(
      approvedFields.length === allFields.length
        ? "Cambios aprobados."
        : approvedFields.length === 0
          ? "Cambios rechazados."
          : `Decisión aplicada: ${approvedFields.length} de ${allFields.length} campo(s) aprobados.`
    );
    setTimeout(() => setMsg(null), 4000);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {err && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
      {msg && <div className="rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 px-4 py-2 text-sm text-[hsl(var(--success-text))]">{msg}</div>}
      {rows.length === 0 && <section className="panel p-10 text-center text-sm text-muted-foreground">No hay cambios de perfil para revisar.</section>}
      {rows.map((r) => (
        <section key={r.id} className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href={`/admin/employees/${r.userId}`} className="text-sm font-semibold hover:text-[hsl(var(--primary-text))] hover:underline">{r.employee}</Link>
              <div className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</div>
            </div>
            <div className="flex items-center gap-2">
              {r.status === "PENDING" && (
                <>
                  <button className="btn-primary text-xs" disabled={busy === r.id} onClick={() => applyDecision(r)}>
                    <Check className="h-4 w-4" /> Aplicar decisión
                  </button>
                  <button className="btn-ghost text-xs text-destructive" disabled={busy === r.id} onClick={() => reject(r.id)}>
                    <X className="h-4 w-4" /> Rechazar todo
                  </button>
                </>
              )}
              {r.status === "APPROVED" && <span className="badge-success">aprobado</span>}
              {r.status === "REJECTED" && <span className="badge-danger">rechazado</span>}
            </div>
          </div>
          {r.status === "PENDING" && (
            <p className="mt-2 text-xs text-muted-foreground">Tildá los campos que querés aprobar. Los destildados se rechazan al aplicar la decisión.</p>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {r.status === "PENDING" && <th className="py-2 pr-3">Aprobar</th>}
                  <th className="py-2 pr-3">Campo</th>
                  <th className="py-2 pr-3">Actual</th>
                  <th className="py-2">Propuesto</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(r.changes).map(([field, c]) => (
                  <tr key={field} className="border-b border-border/40 last:border-0">
                    {r.status === "PENDING" && (
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={fieldsFor(r)[field] ?? true}
                          onChange={() => toggleField(r, field)}
                          aria-label={`Aprobar ${FIELD_LABELS[field] ?? field}`}
                        />
                      </td>
                    )}
                    <td className="py-2 pr-3 font-medium">{FIELD_LABELS[field] ?? field}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {c.type === "image" ? <Thumb url={c.from} alt="imagen actual" /> : c.from || "—"}
                    </td>
                    <td className="py-2 text-[hsl(var(--primary-text))]">
                      {c.type === "image" ? <Thumb url={c.to} alt="imagen propuesta" /> : c.to || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.note && <div className="mt-2 text-xs text-muted-foreground">{r.status === "REJECTED" ? "Motivo del rechazo: " : "Detalle: "}{r.note}</div>}
        </section>
      ))}
    </div>
  );
}

function Thumb({ url, alt }: { url: string; alt: string }) {
  if (!url) return <span className="text-muted-foreground">—</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} loading="lazy" decoding="async" className="h-24 w-auto max-w-[160px] rounded-lg border border-border/60 bg-white object-contain p-1" />;
}
