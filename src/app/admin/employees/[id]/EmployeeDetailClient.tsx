"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Lock, LockOpen, Smartphone, Send, Upload } from "lucide-react";
import { formatDate } from "@/lib/utils";

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const SHOE_SIZES = Array.from({ length: 48 - 36 + 1 }, (_, i) => String(36 + i));

function SizeOptions({ options }: { options: string[] }) {
  return (
    <>
      <option value="">—</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </>
  );
}

type Profile = {
  legajo: string;
  lastName: string;
  firstName: string;
  dob: string;
  dni: string;
  cuil: string;
  hireDate: string;
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
  vacationWeeksPerYear: number;
  dniFrontBlobUrl: string | null;
  dniBackBlobUrl: string | null;
  licenseFrontBlobUrl: string | null;
  licenseBackBlobUrl: string | null;
  healthCardFrontBlobUrl: string | null;
  healthCardBackBlobUrl: string | null;
  faceImageBlobUrl: string | null;
  signatureBlobUrl: string | null;
};

type Delivery = {
  id: string;
  type: "PAYSLIP" | "INTERNAL_DOC" | "OTHER";
  title: string;
  createdAt: string;
  openedAt: string | null;
  signedBlobUrl: string | null;
};

export function EmployeeDetailClient({ initial }: {
  initial: { id: string; email: string; status: string; hasDevice: boolean; profile: Profile; deliveries: Delivery[] };
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initial.email);
  const [p, setP] = useState<Profile>(initial.profile);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const set = (field: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setP((prev) => ({ ...prev, [field]: e.target.value }));

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/employees/${initial.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        legajo: p.legajo || null,
        lastName: p.lastName,
        firstName: p.firstName,
        dob: p.dob,
        dni: p.dni || null,
        cuil: p.cuil,
        hireDate: p.hireDate || null,
        category: p.category,
        phone: p.phone,
        professionalLicenseExpiry: p.professionalLicenseExpiry || null,
        healthCardExpiry: p.healthCardExpiry,
        shirtSize: p.shirtSize,
        hoodieSize: p.hoodieSize,
        jacketSize: p.jacketSize,
        pantsSize: p.pantsSize,
        shoeSize: p.shoeSize,
        address: p.address,
        addressNumber: p.addressNumber,
        neighborhood: p.neighborhood,
        city: p.city,
        postalCode: p.postalCode,
        emergencyContact: p.emergencyContact,
        emergencyPhone: p.emergencyPhone,
        vacationWeeksPerYear: Number(p.vacationWeeksPerYear),
      }),
    });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: out.error ?? "Error al guardar" });
    setMsg({ kind: "ok", text: "Ficha guardada" });
    router.refresh();
  }

  async function action(path: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${initial.id}/${path}`, { method: "POST" });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: out.error ?? "Error" });
    if (out.tempPassword) {
      try { await navigator.clipboard.writeText(out.tempPassword); } catch {}
      setMsg({ kind: "ok", text: `Contraseña reseteada a "${out.tempPassword}"` });
    } else {
      setMsg({ kind: "ok", text: "Listo" });
    }
    router.refresh();
  }

  const isDisabled = initial.status === "DISABLED";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* Datos del legajo */}
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Datos del legajo</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Legajo"><input className="surface-control" value={p.legajo} onChange={set("legajo")} /></Field>
            <Field label="Apellidos"><input className="surface-control" value={p.lastName} onChange={set("lastName")} /></Field>
            <Field label="Nombres"><input className="surface-control" value={p.firstName} onChange={set("firstName")} /></Field>
            <Field label="Fecha de nacimiento"><input type="date" className="surface-control" value={p.dob} onChange={set("dob")} /></Field>
            <Field label="DNI"><input className="surface-control" value={p.dni} onChange={set("dni")} placeholder="12345678" /></Field>
            <Field label="CUIL"><input className="surface-control" value={p.cuil} onChange={set("cuil")} placeholder="20-12345678-9" /></Field>
            <Field label="Fecha de ingreso"><input type="date" className="surface-control" value={p.hireDate} onChange={set("hireDate")} /></Field>
            <Field label="Categoría">
              <select className="surface-select" value={p.category} onChange={set("category")}>
                <option value="DRIVER">Chofer</option>
                <option value="HELPER">Ayudante</option>
              </select>
            </Field>
            <Field label="Teléfono"><input className="surface-control" value={p.phone} onChange={set("phone")} /></Field>
            <Field label="Email"><input type="email" className="surface-control" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Semanas de vacaciones / año"><input type="number" min={0} max={10} className="surface-control" value={p.vacationWeeksPerYear} onChange={set("vacationWeeksPerYear")} /></Field>
          </div>
        </section>

        {/* Vencimientos */}
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Vencimientos</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {p.category === "DRIVER" && (
              <Field label="Venc. carnet profesional"><input type="date" className="surface-control" value={p.professionalLicenseExpiry} onChange={set("professionalLicenseExpiry")} /></Field>
            )}
            <Field label="Venc. libreta sanitaria"><input type="date" className="surface-control" value={p.healthCardExpiry} onChange={set("healthCardExpiry")} /></Field>
          </div>
        </section>

        {/* Talles */}
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Talles</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="Remera"><select className="surface-select" value={p.shirtSize} onChange={set("shirtSize")}><SizeOptions options={CLOTHING_SIZES} /></select></Field>
            <Field label="Buzo"><select className="surface-select" value={p.hoodieSize} onChange={set("hoodieSize")}><SizeOptions options={CLOTHING_SIZES} /></select></Field>
            <Field label="Campera"><select className="surface-select" value={p.jacketSize} onChange={set("jacketSize")}><SizeOptions options={CLOTHING_SIZES} /></select></Field>
            <Field label="Pantalón"><select className="surface-select" value={p.pantsSize} onChange={set("pantsSize")}><SizeOptions options={CLOTHING_SIZES} /></select></Field>
            <Field label="Calzado"><select className="surface-select" value={p.shoeSize} onChange={set("shoeSize")}><SizeOptions options={SHOE_SIZES} /></select></Field>
          </div>
        </section>

        {/* Domicilio y emergencia */}
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Domicilio y contacto de emergencia</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Dirección"><input className="surface-control" value={p.address} onChange={set("address")} /></Field>
            <Field label="Numeración"><input className="surface-control" value={p.addressNumber} onChange={set("addressNumber")} /></Field>
            <Field label="Barrio"><input className="surface-control" value={p.neighborhood} onChange={set("neighborhood")} /></Field>
            <Field label="Localidad"><input className="surface-control" value={p.city} onChange={set("city")} /></Field>
            <Field label="Código postal"><input className="surface-control" value={p.postalCode} onChange={set("postalCode")} /></Field>
            <Field label="Contacto de emergencia"><input className="surface-control" value={p.emergencyContact} onChange={set("emergencyContact")} /></Field>
            <Field label="Tel. de emergencia"><input className="surface-control" value={p.emergencyPhone} onChange={set("emergencyPhone")} /></Field>
          </div>
        </section>

        {/* Imágenes */}
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Imágenes y documentos</h2>
          <p className="mt-1 text-xs text-muted-foreground">PNG, JPG o WEBP hasta 8 MB. Se guardan al instante.</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <ImageSlot userId={initial.id} kind="face" label="Foto (frente cara)" url={p.faceImageBlobUrl} onUploaded={(url) => setP((x) => ({ ...x, faceImageBlobUrl: url }))} />
            <ImageSlot userId={initial.id} kind="signature" label="Firma digital" url={p.signatureBlobUrl} onUploaded={(url) => setP((x) => ({ ...x, signatureBlobUrl: url }))} />
            <ImageSlot userId={initial.id} kind="dniFront" label="DNI (frente)" url={p.dniFrontBlobUrl} onUploaded={(url) => setP((x) => ({ ...x, dniFrontBlobUrl: url }))} />
            <ImageSlot userId={initial.id} kind="dniBack" label="DNI (dorso)" url={p.dniBackBlobUrl} onUploaded={(url) => setP((x) => ({ ...x, dniBackBlobUrl: url }))} />
            {p.category === "DRIVER" && (
              <>
                <ImageSlot userId={initial.id} kind="licenseFront" label="Carnet (frente)" url={p.licenseFrontBlobUrl} onUploaded={(url) => setP((x) => ({ ...x, licenseFrontBlobUrl: url }))} />
                <ImageSlot userId={initial.id} kind="licenseBack" label="Carnet (dorso)" url={p.licenseBackBlobUrl} onUploaded={(url) => setP((x) => ({ ...x, licenseBackBlobUrl: url }))} />
              </>
            )}
            <ImageSlot userId={initial.id} kind="healthFront" label="Libreta sanitaria (frente)" url={p.healthCardFrontBlobUrl} onUploaded={(url) => setP((x) => ({ ...x, healthCardFrontBlobUrl: url }))} />
            <ImageSlot userId={initial.id} kind="healthBack" label="Libreta sanitaria (dorso)" url={p.healthCardBackBlobUrl} onUploaded={(url) => setP((x) => ({ ...x, healthCardBackBlobUrl: url }))} />
          </div>
        </section>

        {msg && (
          <div className={`rounded-xl border px-4 py-2 text-sm ${msg.kind === "ok" ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{msg.text}</div>
        )}

        <div className="flex justify-end">
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar ficha"}</button>
        </div>
      </div>

      {/* Columna lateral: acciones + documentos */}
      <div className="space-y-6">
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Cuenta</h2>
          <div className="mt-4 space-y-2">
            <button className="btn-ghost w-full justify-start" disabled={busy} onClick={() => action("reset-password", "¿Resetear la contraseña a la clave temporaria Emmalva01?")}>
              <KeyRound className="h-4 w-4" /> Resetear contraseña
            </button>
            <button className="btn-ghost w-full justify-start" disabled={busy || !initial.hasDevice} onClick={() => action("reset-device", "¿Resetear el dispositivo? El empleado va a tener que registrar biometría de nuevo.")}>
              <Smartphone className="h-4 w-4" /> Resetear dispositivo
            </button>
            {isDisabled ? (
              <button className="btn-ghost w-full justify-start" disabled={busy} onClick={() => action("enable")}>
                <LockOpen className="h-4 w-4" /> Desbloquear usuario
              </button>
            ) : (
              <button className="btn-ghost w-full justify-start text-destructive" disabled={busy} onClick={() => action("disable", "¿Bloquear al usuario? No va a poder ingresar hasta que lo desbloquees.")}>
                <Lock className="h-4 w-4" /> Bloquear usuario
              </button>
            )}
          </div>
          {isDisabled && <p className="mt-3 text-xs text-destructive">Este usuario está bloqueado.</p>}
        </section>

        <section className="panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Documentos</h2>
            <Link href={`/admin/deliveries?recipientId=${initial.id}`} className="btn-ghost text-xs">
              <Send className="h-4 w-4" /> Enviar
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {initial.deliveries.length === 0 && <li className="text-sm text-muted-foreground">Sin documentos enviados.</li>}
            {initial.deliveries.map((d) => (
              <li key={d.id} className="surface-card p-3">
                <div className="text-sm font-medium">{d.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {d.type === "PAYSLIP" ? "Recibo" : d.type === "INTERNAL_DOC" ? "Notificación" : "Otro"} · {formatDate(d.createdAt)} ·{" "}
                  {d.openedAt ? `abierto y firmado el ${formatDate(d.openedAt)}` : "sin abrir"}
                </div>
                {d.signedBlobUrl && (
                  <a href={d.signedBlobUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline underline-offset-2">Ver copia firmada</a>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
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

function ImageSlot({ userId, kind, label, url, onUploaded }: {
  userId: string;
  kind: string;
  label: string;
  url: string | null;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    const form = new FormData();
    form.set("file", file);
    form.set("kind", kind);
    const res = await fetch(`/api/admin/employees/${userId}/uploads`, { method: "POST", body: form });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(out.error ?? "Error");
    onUploaded(out.url);
  }

  return (
    <div className="surface-card p-3">
      <div className="eyebrow">{label}</div>
      <button
        type="button"
        className="mt-2 grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg border border-dashed border-border/80 bg-secondary/40 transition hover:border-primary/50"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <Upload className="h-4 w-4" />
            {busy ? "Subiendo…" : "Subir"}
          </span>
        )}
      </button>
      {err && <div className="mt-1 text-[11px] text-destructive">{err}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
