import Link from "next/link";

export function VersionBadge() {
  const v = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.00";
  return (
    <Link href="/changelog" className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 hover:text-primary transition">
      v{v}
    </Link>
  );
}
