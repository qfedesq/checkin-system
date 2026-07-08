import "server-only";
import { NextResponse } from "next/server";
import { requireActiveUser } from "./session-guard";

export async function requireAdmin() {
  const { session, user, error } = await requireActiveUser();
  if (error) return { error, session: null as never };
  if (user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null as never };
  }
  return { session, error: null as never };
}
