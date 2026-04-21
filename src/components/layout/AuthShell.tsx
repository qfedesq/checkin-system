import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { VersionBadge } from "@/components/ui/VersionBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-aurora-primary">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <VersionBadge />
          </div>
        </div>
        <div className="panel p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
        <div className="mt-auto pt-10 text-center text-[11px] mono uppercase tracking-[0.22em] text-muted-foreground/60">
          <Link href="/help">manual</Link> · <Link href="/changelog">changelog</Link>
        </div>
      </div>
    </div>
  );
}
