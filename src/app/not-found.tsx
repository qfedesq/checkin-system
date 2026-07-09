import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel flex flex-col items-center gap-3 px-8 py-10 text-center">
        <p className="eyebrow">404</p>
        <h1 className="text-xl font-bold tracking-tight">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground">
          La página que buscás no existe o fue movida.
        </p>
        <Link href="/" className="btn-primary mt-2">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
