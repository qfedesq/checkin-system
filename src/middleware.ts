import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// /api/cron se autentica solo (CRON_SECRET) — el middleware no debe redirigirlo a /login
const PUBLIC_PATHS = ["/login", "/forgot-password", "/api/auth", "/api/cron"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/manifest.webmanifest"
  ) {
    return NextResponse.next();
  }

  const session = req.auth;
  if (!session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (session.user.status === "PENDING_APPROVAL") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Cuenta pendiente de aprobación" }, { status: 403 });
    }
    if (pathname !== "/pending") {
      const url = req.nextUrl.clone();
      url.pathname = "/pending";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Cuenta deshabilitada: la app entera queda vedada; se muestra /blocked con opción de cerrar sesión.
  // (Sólo aplica si el propio JWT ya trae status DISABLED; el caso más común —quedar bloqueado con un
  // token viejo que todavía dice ACTIVE— lo atrapan los layouts revalidando contra la DB → /blocked.)
  if (session.user.status === "DISABLED") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Tu cuenta está deshabilitada." }, { status: 403 });
    }
    if (pathname !== "/blocked") {
      const url = req.nextUrl.clone();
      url.pathname = "/blocked";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (session.user.mustChangePassword && pathname !== "/reset-password" && pathname !== "/blocked" && !pathname.startsWith("/api/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/reset-password";
    return NextResponse.redirect(url);
  }

  if (
    session.user.status === "ACTIVE" &&
    !session.user.hasWebauthn &&
    !pathname.startsWith("/setup-biometrics") &&
    !pathname.startsWith("/api/") &&
    pathname !== "/reset-password" &&
    pathname !== "/blocked"
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/setup-biometrics";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && session.user.role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
