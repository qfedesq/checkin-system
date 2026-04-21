import "server-only";
import { NextResponse } from "next/server";
import { auth } from "./auth";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null as never };
  }
  return { session, error: null as never };
}
