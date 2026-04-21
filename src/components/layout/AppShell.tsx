"use client";

import { useEffect, useState } from "react";
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
  Clock,
  BookOpen,
  LogOut,
  Send,
  Menu,
  X,
  MoreHorizontal,
} from "lucide-react";
import { Logo, LogoIcon } from "@/components/brand/Logo";
import { VersionBadge } from "@/components/ui/VersionBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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

// Primary tabs en mobile bottom nav — los demás viven en el drawer
const EMPLOYEE_MOBILE_PRIMARY: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Inicio" },
  { href: "/calendar", icon: Calendar, label: "Calendario" },
  { href: "/checkin", icon: MapPin, label: "Check-in" },
  { href: "/inbox", icon: Inbox, label: "Recibidos" },
];

const ADMIN_MOBILE_PRIMARY: NavItem[] = [
  { href: "/admin", icon: LayoutDashboard, label: "Panel" },
  { href: "/admin/users", icon: Users, label: "Usuarios" },
  { href: "/admin/leaves", icon: Calendar, label: "Solicitudes" },
  { href: "/admin/attendance", icon: Clock, label: "Jornadas" },
];

export function AppShell({
  role,
  userName,
  adminBadges,
  children,
}: {
  role: "ADMIN" | "EMPLOYEE";
  userName?: string | null;
  adminBadges?: Record<string, number>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = role === "ADMIN" ? ADMIN_NAV : EMPLOYEE_NAV;
  const mobilePrimary = role === "ADMIN" ? ADMIN_MOBILE_PRIMARY : EMPLOYEE_MOBILE_PRIMARY;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const badgeFor = (href: string) => adminBadges?.[href] ?? 0;
  const totalPending = adminBadges ? Object.values(adminBadges).reduce((a, b) => a + b, 0) : 0;

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
          <Link href={role === "ADMIN" ? "/admin" : "/dashboard"} className="flex items-center gap-2">
            <LogoIcon className="h-7 w-7" />
            <span className="text-base font-bold">Emmalva</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button className="rail-icon-button relative" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú">
              <Menu className="h-5 w-5" />
              {totalPending > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{totalPending > 99 ? "99+" : totalPending}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 pb-28 pt-4 md:px-6 md:py-6 md:pb-12">
        {/* Desktop sidebar */}
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col gap-3 md:flex">
          <div className="panel p-4">
            <Logo />
          </div>
          <nav className="panel flex-1 p-3">
            <ul className="space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const count = badgeFor(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition",
                        isActive(item.href) ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {count > 0 && (
                        <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{count > 99 ? "99+" : count}</span>
                      )}
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
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <form action="/api/auth/signout" method="post">
                  <button className="rail-icon-button" title="Cerrar sesión">
                    <LogOut className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
              <VersionBadge />
              <span className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">Emmalva</span>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="grid grid-cols-5">
          {mobilePrimary.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const count = badgeFor(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition relative",
                    active ? "text-primary" : "text-muted-foreground active:text-foreground",
                  )}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {count > 0 && (
                      <span className="absolute -right-2 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{count > 9 ? "9+" : count}</span>
                    )}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex w-full flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground active:text-foreground"
            >
              <MoreHorizontal className="h-5 w-5" />
              Más
            </button>
          </li>
        </ul>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[82%] max-w-[340px] bg-background border-l border-border/60 shadow-panel flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/60">
              <Logo />
              <button className="rail-icon-button" onClick={() => setDrawerOpen(false)} aria-label="Cerrar menú">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {nav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const count = badgeFor(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition",
                          active ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground active:bg-secondary active:text-foreground",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="flex-1">{item.label}</span>
                        {count > 0 && (
                          <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{count > 99 ? "99+" : count}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="border-t border-border/60 p-4">
              <div className="mb-3">
                <div className="truncate text-sm font-medium">{userName ?? "—"}</div>
                <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {role === "ADMIN" ? "administrador" : "empleado"}
                </div>
              </div>
              <form action="/api/auth/signout" method="post">
                <button className="btn-ghost w-full">
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </button>
              </form>
              <div className="mt-3 flex items-center justify-between">
                <VersionBadge />
                <span className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">Emmalva</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
