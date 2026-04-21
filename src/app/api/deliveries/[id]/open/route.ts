import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signPdf } from "@/lib/pdf-sign";
import { uploadBlob } from "@/lib/blob";
import { recordAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await ctx.params;

  const doc = await prisma.deliveredDocument.findUnique({
    where: { id },
    include: { recipient: { include: { profile: true } } },
  });
  if (!doc) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (doc.recipientId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Si ya firmamos, servimos el firmado
  if (doc.signedBlobUrl) {
    return NextResponse.redirect(doc.signedBlobUrl);
  }

  // Descargar original
  const resp = await fetch(doc.originalBlobUrl);
  if (!resp.ok) return NextResponse.json({ error: "No pudimos leer el archivo" }, { status: 500 });
  const originalBytes = new Uint8Array(await resp.arrayBuffer());

  // Descargar firma del empleado si existe
  let signatureBytes: Uint8Array | null = null;
  if (doc.recipient.profile?.signatureBlobUrl) {
    try {
      const sigRes = await fetch(doc.recipient.profile.signatureBlobUrl);
      if (sigRes.ok) signatureBytes = new Uint8Array(await sigRes.arrayBuffer());
    } catch {}
  }

  const profile = doc.recipient.profile;
  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : doc.recipient.email;
  const cuil = profile?.cuil && !profile.cuil.startsWith("PENDING-") ? profile.cuil : "—";

  const { bytes, hash } = await signPdf(originalBytes, signatureBytes, { name, cuil, email: doc.recipient.email });

  const filename = `${doc.title.replace(/[^a-z0-9áéíóúñ _-]/gi, "_")}-firmado.pdf`;
  const signedUrl = await uploadBlob(`deliveries/${doc.recipientId}/signed`, Buffer.from(bytes), filename, "application/pdf");

  await prisma.deliveredDocument.update({
    where: { id },
    data: { signedBlobUrl: signedUrl, originalHash: hash, openedAt: new Date() },
  });
  await recordAudit({ actorId: session.user.id, action: "delivery.open", subjectId: id, metadata: { hash } });

  return NextResponse.redirect(signedUrl);
}
