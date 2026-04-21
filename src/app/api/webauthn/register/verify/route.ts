import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { origin, rpID, deviceHashFromCredentialId } from "@/lib/webauthn";
import { recordAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { attestation } = await req.json();
  const challenge = await prisma.webAuthnChallenge.findFirst({
    where: { userId: session.user.id, kind: "register", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return NextResponse.json({ error: "Challenge expirado" }, { status: 400 });

  const verification = await verifyRegistrationResponse({
    response: attestation,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verificación fallida" }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  const credentialId = Buffer.from(credential.id, "base64url");
  const deviceId = deviceHashFromCredentialId(credentialId);

  const collision = await prisma.user.findUnique({ where: { deviceId } });
  if (collision && collision.id !== session.user.id) {
    return NextResponse.json({ error: "Este dispositivo ya está asignado a otro usuario" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.webAuthnCredential.create({
      data: {
        userId: session.user.id,
        credentialId,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: credential.transports ?? [],
      },
    }),
    prisma.user.update({ where: { id: session.user.id }, data: { deviceId } }),
    prisma.webAuthnChallenge.delete({ where: { id: challenge.id } }),
  ]);

  await recordAudit({ actorId: session.user.id, action: "webauthn.register", subjectId: session.user.id });
  return NextResponse.json({ ok: true });
}
