import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/api/auth"];

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
    if (pathname !== "/pending") {
      const url = req.nextUrl.clone();
      url.pathname = "/pending";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (session.user.mustChangePassword && pathname !== "/reset-password" && !pathname.startsWith("/api/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/reset-password";
    return NextResponse.redirect(url);
  }

  if (
    session.user.status === "ACTIVE" &&
    !session.user.hasWebauthn &&
    !pathname.startsWith("/setup-biometrics") &&
    !pathname.startsWith("/api/") &&
    pathname !== "/reset-password"
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
