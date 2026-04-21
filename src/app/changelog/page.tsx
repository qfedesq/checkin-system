import Content from "@/content/changelog.mdx";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-aurora-primary">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Volver</Link>
          <span className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">v{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.00"}</span>
        </div>
        <PageHeader eyebrow="historial" title="Changelog" />
        <article className="panel p-8 prose-doc">
          <Content />
        </article>
      </div>
    </div>
  );
}
