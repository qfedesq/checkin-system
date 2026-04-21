import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadBlob } from "@/lib/blob";

const ALLOWED = ["image/png", "image/jpeg"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Formato no permitido" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Archivo demasiado grande (máx 5MB)" }, { status: 400 });

  const url = await uploadBlob(`signatures/${session.user.id}`, file, file.name, file.type);
  return NextResponse.json({ url });
}
