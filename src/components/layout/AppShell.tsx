"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserCircle,
  Calendar,
  FileText,
  Inbox,
  MapPin,
  Users,
  ShieldCheck,
  Upload,
  Clock,
  BookOpen,
  LogOut,
  Send,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { VersionBadge } from "@/components/ui/VersionBadge";
import { cn } from "@/lib/utils";

type NavItem = { href: string; icon: React.ComponentType<{ className?: string }>; label: string };

const EMPLOYEE_NAV: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Inicio" },
  { href: "/profile", icon: UserCircle, label: "Mi perfil" },
  { href: "/calendar", icon: Calendar, label: "Calendario" },
  { href: "/documents", icon: FileText, label: "Documentación" },
  { href: "/inbox", icon: Inbox, label: "Recibidos" },
  { href: "/checkin", icon: MapPin, label: "Check-in" },
  { href: "/help", icon: BookOpen, label: "Ayuda" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", icon: LayoutDashboard, label: "Panel" },
  { href: "/admin/users", icon: Users, label: "Usuarios" },
  { href: "/admin/leaves", icon: Calendar, label: "Vacaciones / Francos" },
  { href: "/admin/documents", icon: ShieldCheck, label: "Documentación" },
  { href: "/admin/deliveries", icon: Send, label: "Entregas" },
  { href: "/admin/attendance", icon: Clock, label: "Jornadas" },
  { href: "/help", icon: BookOpen, label: "Ayuda" },
];

export function AppShell({
  role,
  userName,
  children,
}: {
  role: "ADMIN" | "EMPLOYEE";
  userName?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = role === "ADMIN" ? ADMIN_NAV : EMPLOYEE_NAV;

  return (
    <div className="min-h-screen bg-aurora-primary">
      <div className="mx-auto flex max-w-[1400px] gap-6 px-6 py-6">
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col gap-3 md:flex">
          <div className="panel p-4">
            <Logo />
          </div>
          <nav className="panel flex-1 p-3">
            <ul className="space-y-1">
              {nav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition",
                        active ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-white/[0.04] hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="panel p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{userName ?? "—"}</div>
                <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {role === "ADMIN" ? "administrador" : "empleado"}
                </div>
              </div>
              <form action="/api/auth/signout" method="post">
                <button className="rail-icon-button" title="Cerrar sesión">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
              <VersionBadge />
              <span className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">protofire suite</span>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-12">{children}</main>
      </div>
    </div>
  );
}
