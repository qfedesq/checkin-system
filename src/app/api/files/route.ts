import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyFileToken } from "@/lib/file-token";

// QA-002 (fix completo): proxy autenticado para servir blobs con PII (DNI, licencia, libreta,
// foto de cara, firma, documentos). El cliente nunca recibe la URL real del blob: sólo un
// token de corta vida que este endpoint valida y luego streamea el contenido.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const token = req.nextUrl.searchParams.get("t") ?? "";
  const blobUrl = verifyFileToken(token);
  if (!blobUrl) return NextResponse.json({ error: "Enlace inválido o vencido" }, { status: 401 });

  let upstream: Response;
  try {
    upstream = await fetch(blobUrl);
  } catch {
    return NextResponse.json({ error: "No pudimos leer el archivo" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "No pudimos leer el archivo" }, { status: upstream.status || 502 });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);
  headers.set("cache-control", "private, max-age=60");

  return new NextResponse(upstream.body, { status: 200, headers });
}
