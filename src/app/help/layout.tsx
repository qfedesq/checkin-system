import Link from "next/link";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { AuthShell } from "@/components/layout/AuthShell";

const SECTIONS = [
  { slug: "intro", label: "Introducción" },
  { slug: "employee", label: "Guía del empleado" },
  { slug: "admin", label: "Guía del administrador" },
  { slug: "faq", label: "FAQ" },
];

export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  const body = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="panel p-4">
        <div className="eyebrow mb-3">Manual</div>
        <ul className="space-y-1 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.slug}>
              <Link href={`/help/${s.slug}`} className="block rounded-lg px-3 py-2 text-muted-foreground hover:bg-white/[0.04] hover:text-foreground">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <article className="panel p-8 prose-doc">{children}</article>
    </div>
  );

  if (!session?.user) {
    return (
      <AuthShell title="Manual de usuario">
        {body}
      </AuthShell>
    );
  }

  return (
    <AppShell role={session.user.role} userName={session.user.name ?? session.user.email}>
      {body}
    </AppShell>
  );
}
