"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  legajo: string;
  hireDate: string;
  lastName: string;
  firstName: string;
  dob: string;
  cuil: string;
  category: "DRIVER" | "HELPER";
  phone: string;
  professionalLicenseExpiry: string;
  healthCardExpiry: string;
  shirtSize: string;
  hoodieSize: string;
  jacketSize: string;
  pantsSize: string;
  shoeSize: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  city: string;
  postalCode: string;
  emergencyContact: string;
  emergencyPhone: string;
  signatureBlobUrl: string;
};

const EMPTY: Initial = {
  legajo: "",
  hireDate: "",
  lastName: "",
  firstName: "",
  dob: "",
  cuil: "",
  category: "HELPER",
  phone: "",
  professionalLicenseExpiry: "",
  healthCardExpiry: "",
  shirtSize: "",
  hoodieSize: "",
  jacketSize: "",
  pantsSize: "",
  shoeSize: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  city: "",
  postalCode: "",
  emergencyContact: "",
  emergencyPhone: "",
  signatureBlobUrl: "",
};

export function ProfileForm({ initial, email }: { initial: Initial | null; email: string }) {
  const router = useRouter();
  const [data, setData] = useState<Initial>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isDriver = data.category === "DRIVER";

  function set<K extends keyof Initial>(key: K, v: Initial[K]) {
    setData((d) => ({ ...d, [key]: v }));
  }

  async function onSignatureChange(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "signature");
    const res = await fetch("/api/uploads/signature", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ kind: "err", text: data.error ?? "No pudimos subir la firma" });
      return;
    }
    set("signatureBlobUrl", data.url);
    setMsg({ kind: "ok", text: "Firma cargada" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ kind: "err", text: body.error ?? "No pudimos guardar los datos." });
      return;
    }
    setMsg({ kind: "ok", text: "Datos guardados" });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Identificación</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Email"><input disabled className="surface-control" value={email} /></Field>
          <Field label="Legajo (asignado por admin)">
            <input disabled className="surface-control" value={data.legajo || "—"} />
          </Field>
          <Field label="Apellido"><input className="surface-control" required value={data.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
          <Field label="Nombre"><input className="surface-control" required value={data.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
          <Field label="Fecha de nacimiento"><input type="date" className="surface-control" required value={data.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
          <Field label="CUIL"><input className="surface-control" required value={data.cuil} onChange={(e) => set("cuil", e.target.value)} placeholder="20-12345678-9" /></Field>
          <Field label="Fecha de ingreso (asignada por admin)"><input disabled className="surface-control" value={data.hireDate || "—"} /></Field>
          <Field label="Categoría">
            <select className="surface-select" value={data.category} onChange={(e) => set("category", e.target.value as "DRIVER" | "HELPER")}>
              <option value="HELPER">Ayudante</option>
              <option value="DRIVER">Chofer</option>
            </select>
          </Field>
          <Field label="Teléfono de contacto"><input className="surface-control" required value={data.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Vencimientos</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Libreta sanitaria · vence"><input type="date" className="surface-control" required value={data.healthCardExpiry} onChange={(e) => set("healthCardExpiry", e.target.value)} /></Field>
          {isDriver && (
            <Field label="Carnet profesional · vence"><input type="date" className="surface-control" required={isDriver} value={data.professionalLicenseExpiry} onChange={(e) => set("professionalLicenseExpiry", e.target.value)} /></Field>
          )}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Indumentaria</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
          <Field label="Remera"><input className="surface-control" value={data.shirtSize} onChange={(e) => set("shirtSize", e.target.value)} /></Field>
          <Field label="Buzo"><input className="surface-control" value={data.hoodieSize} onChange={(e) => set("hoodieSize", e.target.value)} /></Field>
          <Field label="Campera"><input className="surface-control" value={data.jacketSize} onChange={(e) => set("jacketSize", e.target.value)} /></Field>
          <Field label="Pantalón"><input className="surface-control" value={data.pantsSize} onChange={(e) => set("pantsSize", e.target.value)} /></Field>
          <Field label="Calzado"><input className="surface-control" value={data.shoeSize} onChange={(e) => set("shoeSize", e.target.value)} /></Field>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Domicilio</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Dirección"><input className="surface-control" required value={data.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Numeración"><input className="surface-control" required value={data.addressNumber} onChange={(e) => set("addressNumber", e.target.value)} /></Field>
          <Field label="Barrio"><input className="surface-control" value={data.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} /></Field>
          <Field label="Localidad"><input className="surface-control" required value={data.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="Código postal"><input className="surface-control" required value={data.postalCode} onChange={(e) => set("postalCode", e.target.value)} /></Field>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Contacto de emergencia</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nombre"><input className="surface-control" required value={data.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} /></Field>
          <Field label="Teléfono"><input className="surface-control" required value={data.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} /></Field>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Firma digital</h2>
        <p className="mt-1 text-sm text-muted-foreground">Subí una imagen PNG o JPG de tu firma sobre fondo blanco. Se usará automáticamente cuando abras recibos y documentos internos.</p>
        <div className="mt-4 flex items-center gap-6">
          <div className="surface-card flex h-24 w-48 items-center justify-center overflow-hidden p-2">
            {data.signatureBlobUrl ? (
              <img src={data.signatureBlobUrl} alt="firma" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">sin firma</span>
            )}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onSignatureChange(e.target.files[0])}
            />
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost">
              {data.signatureBlobUrl ? "Cambiar firma" : "Subir firma"}
            </button>
          </div>
        </div>
      </section>

      {msg && (
        <div className={`rounded-xl border px-4 py-2 text-sm ${msg.kind === "ok" ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{msg.text}</div>
      )}

      <div className="flex justify-end gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
