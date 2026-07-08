"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { SignaturePad } from "./SignaturePad";

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
  faceImageBlobUrl: string;
  healthCardFrontBlobUrl: string;
  healthCardBackBlobUrl: string;
  licenseFrontBlobUrl: string;
  licenseBackBlobUrl: string;
};

const EMPTY: Initial = {
  legajo: "", hireDate: "", lastName: "", firstName: "", dob: "", cuil: "", category: "HELPER",
  phone: "", professionalLicenseExpiry: "", healthCardExpiry: "",
  shirtSize: "", hoodieSize: "", jacketSize: "", pantsSize: "", shoeSize: "",
  address: "", addressNumber: "", neighborhood: "", city: "", postalCode: "",
  emergencyContact: "", emergencyPhone: "", signatureBlobUrl: "", faceImageBlobUrl: "",
  healthCardFrontBlobUrl: "", healthCardBackBlobUrl: "", licenseFrontBlobUrl: "", licenseBackBlobUrl: "",
};

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const SHOE_SIZES = Array.from({ length: 48 - 36 + 1 }, (_, i) => String(36 + i));

export function ProfileForm({ initial, email, pendingFields }: { initial: Initial | null; email: string; pendingFields?: string[] }) {
  const router = useRouter();
  const [data, setData] = useState<Initial>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const isDriver = data.category === "DRIVER";
  // Solo-admin: CUIL (viene del alta de ARCA), legajo y fecha de ingreso (administrativos)
  // y el email (login). Todo lo demás lo carga el propio empleado.
  const locked = initial !== null;
  const hasPending = (pendingFields?.length ?? 0) > 0;

  function set<K extends keyof Initial>(key: K, v: Initial[K]) {
    setData((d) => ({ ...d, [key]: v }));
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
    if (body.completed || body.created) {
      setMsg({ kind: "ok", text: "¡Listo! Datos guardados." });
      router.push("/dashboard");
      router.refresh();
      return;
    }
    if (body.pendingApproval) {
      setMsg({ kind: "ok", text: "Cambios enviados: quedan pendientes de aprobación del administrador. Te va a llegar una notificación cuando los revise." });
    } else if (body.unchanged) {
      setMsg({ kind: "ok", text: "No hay cambios para guardar" });
    } else {
      setMsg({ kind: "ok", text: "Datos guardados" });
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {hasPending && (
        <div className="rounded-xl border border-[hsl(19_95%_53%)]/30 bg-[hsl(19_95%_53%)]/10 px-4 py-3 text-sm">
          Tenés <strong>cambios pendientes de aprobación</strong> del administrador. Hasta que los revise, no podés enviar nuevos cambios.
        </div>
      )}
      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Identificación</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Email"><input disabled className="surface-control" value={email} /></Field>
          <Field label="Legajo (asignado por admin)"><input disabled className="surface-control" value={data.legajo || "—"} /></Field>
          <Field label="Apellido"><input className="surface-control" required value={data.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
          <Field label="Nombre"><input className="surface-control" required value={data.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
          <Field label="Fecha de nacimiento"><input type="date" className="surface-control" required value={data.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
          <Field label="CUIL (lo carga el admin)"><input className="surface-control" required disabled={locked} value={data.cuil} onChange={(e) => set("cuil", e.target.value)} placeholder="20-12345678-9" /></Field>
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
        <p className="mt-1 text-sm text-muted-foreground">Cargá la fecha de vencimiento y adjuntá una foto de cada lado del documento.</p>

        <div className="mt-4">
          <Field label="Libreta sanitaria · vence"><input type="date" className="surface-control" required value={data.healthCardExpiry} onChange={(e) => set("healthCardExpiry", e.target.value)} /></Field>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:max-w-md">
            <ImageSlot label="Libreta (frente)" kind="healthFront" url={data.healthCardFrontBlobUrl} onUploaded={(u) => set("healthCardFrontBlobUrl", u)} onError={(t) => setMsg({ kind: "err", text: t })} />
            <ImageSlot label="Libreta (dorso)" kind="healthBack" url={data.healthCardBackBlobUrl} onUploaded={(u) => set("healthCardBackBlobUrl", u)} onError={(t) => setMsg({ kind: "err", text: t })} />
          </div>
        </div>

        {isDriver && (
          <div className="mt-6">
            <Field label="Carnet profesional · vence"><input type="date" className="surface-control" required value={data.professionalLicenseExpiry} onChange={(e) => set("professionalLicenseExpiry", e.target.value)} /></Field>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:max-w-md">
              <ImageSlot label="Carnet (frente)" kind="licenseFront" url={data.licenseFrontBlobUrl} onUploaded={(u) => set("licenseFrontBlobUrl", u)} onError={(t) => setMsg({ kind: "err", text: t })} />
              <ImageSlot label="Carnet (dorso)" kind="licenseBack" url={data.licenseBackBlobUrl} onUploaded={(u) => set("licenseBackBlobUrl", u)} onError={(t) => setMsg({ kind: "err", text: t })} />
            </div>
          </div>
        )}
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Indumentaria</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
          <Field label="Remera"><SizeSelect options={CLOTHING_SIZES} value={data.shirtSize} onChange={(v) => set("shirtSize", v)} /></Field>
          <Field label="Buzo"><SizeSelect options={CLOTHING_SIZES} value={data.hoodieSize} onChange={(v) => set("hoodieSize", v)} /></Field>
          <Field label="Campera"><SizeSelect options={CLOTHING_SIZES} value={data.jacketSize} onChange={(v) => set("jacketSize", v)} /></Field>
          <Field label="Pantalón"><SizeSelect options={CLOTHING_SIZES} value={data.pantsSize} onChange={(v) => set("pantsSize", v)} /></Field>
          <Field label="Calzado"><SizeSelect options={SHOE_SIZES} value={data.shoeSize} onChange={(v) => set("shoeSize", v)} /></Field>
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
        <h2 className="text-lg font-semibold">Foto de perfil</h2>
        <p className="mt-1 text-sm text-muted-foreground">Subí una foto de frente de tu cara.</p>
        <div className="mt-4 w-40">
          <ImageSlot label="Foto" kind="face" url={data.faceImageBlobUrl} onUploaded={(u) => set("faceImageBlobUrl", u)} onError={(t) => setMsg({ kind: "err", text: t })} contain />
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Firma digital</h2>
        <p className="mt-1 text-sm text-muted-foreground">Firmá en el recuadro con el dedo. Se usa automáticamente cuando abrís recibos y documentos internos.</p>
        <div className="mt-4">
          <SignaturePad url={data.signatureBlobUrl} onUploaded={(u) => set("signatureBlobUrl", u)} onError={(t) => setMsg({ kind: "err", text: t })} />
        </div>
      </section>

      {msg && (
        <div className={`rounded-xl border px-4 py-2 text-sm ${msg.kind === "ok" ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{msg.text}</div>
      )}

      <div className="flex justify-end gap-2">
        <button type="submit" className="btn-primary" disabled={busy || hasPending}>
          {busy ? "Enviando…" : locked ? "Enviar cambios para aprobación" : "Guardar datos"}
        </button>
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

function SizeSelect({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className="surface-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function ImageSlot({ label, kind, url, onUploaded, onError, contain }: {
  label: string;
  kind: string;
  url: string;
  onUploaded: (url: string) => void;
  onError: (text: string) => void;
  contain?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("kind", kind);
    const res = await fetch("/api/profile/uploads", { method: "POST", body: form });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) return onError(out.error ?? "No pudimos subir la imagen");
    onUploaded(out.url);
  }

  return (
    <div>
      <span className="eyebrow">{label}</span>
      <button
        type="button"
        className="mt-1 grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg border border-dashed border-border/80 bg-secondary/40 transition hover:border-primary/50"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className={contain ? "h-full w-full object-contain p-1" : "h-full w-full object-cover"} />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <Upload className="h-4 w-4" />
            {busy ? "Subiendo…" : "Subir"}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
      />
    </div>
  );
}
