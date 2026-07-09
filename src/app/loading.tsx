import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel flex flex-col items-center gap-3 px-8 py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="eyebrow">Cargando…</p>
      </div>
    </div>
  );
}
