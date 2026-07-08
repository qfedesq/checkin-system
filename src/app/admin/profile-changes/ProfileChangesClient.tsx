"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const FIELD_LABELS: Record<string, string> = {
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
};

type Row = {
  id: string;
  employee: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  changes: Record<string, { from: string; to: string }>;
  note: string | null;
};

export function ProfileChangesClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    let body: BodyInit | undefined;
    if (action === "reject") {
      const note = window.prompt("Motivo del rechazo (opcional):") ?? "";
      body = JSON.stringify({ note });
    }
    setBusy(id);
    setErr(null);
    const res = await fetch(`/api/admin/profile-changes/${id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const out = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(out.error ?? "Error");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {err && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
      {rows.length === 0 && <section className="panel p-10 text-center text-sm text-muted-foreground">No hay cambios de perfil para revisar.</section>}
      {rows.map((r) => (
        <section key={r.id} className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href={`/admin/employees/${r.userId}`} className="text-sm font-semibold hover:text-primary hover:underline">{r.employee}</Link>
              <div className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</div>
            </div>
            <div className="flex items-center gap-2">
              {r.status === "PENDING" && (
                <>
                  <button className="btn-primary text-xs" disabled={busy === r.id} onClick={() => act(r.id, "approve")}>
                    <Check className="h-4 w-4" /> Aprobar
                  </button>
                  <button className="btn-ghost text-xs text-destructive" disabled={busy === r.id} onClick={() => act(r.id, "reject")}>
                    <X className="h-4 w-4" /> Rechazar
                  </button>
                </>
              )}
              {r.status === "APPROVED" && <span className="badge-success">aprobado</span>}
              {r.status === "REJECTED" && <span className="badge-danger">rechazado</span>}
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="py-2 pr-3">Campo</th>
                  <th className="py-2 pr-3">Actual</th>
                  <th className="py-2">Propuesto</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(r.changes).map(([field, { from, to }]) => (
                  <tr key={field} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3 font-medium">{FIELD_LABELS[field] ?? field}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{from || "—"}</td>
                    <td className="py-2 text-primary">{to || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.note && <div className="mt-2 text-xs text-muted-foreground">Motivo del rechazo: {r.note}</div>}
        </section>
      ))}
    </div>
  );
}
