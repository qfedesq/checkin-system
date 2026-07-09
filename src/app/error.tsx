"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel flex flex-col items-center gap-3 px-8 py-10 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <h1 className="text-xl font-bold tracking-tight">Algo salió mal</h1>
        <p className="text-sm text-muted-foreground">
          Ocurrió un error inesperado. Podés intentar de nuevo.
        </p>
        <button type="button" onClick={() => reset()} className="btn-primary mt-2">
          Reintentar
        </button>
      </div>
    </div>
  );
}
