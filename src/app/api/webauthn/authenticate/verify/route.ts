import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { origin, rpID, deviceHashFromCredentialId } from "@/lib/webauthn";
import { recordAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { assertion } = await req.json();
  const credentialIdBuf = Buffer.from(assertion.id, "base64url");
  const cred = await prisma.webAuthnCredential.findUnique({ where: { credentialId: credentialIdBuf } });

  if (!cred || cred.userId !== session.user.id) {
    return NextResponse.json({ ok: false, error: "Dispositivo no autorizado para este usuario" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });

  const deviceId = deviceHashFromCredentialId(credentialIdBuf);
  if (user.deviceId && user.deviceId !== deviceId) {
    return NextResponse.json({ ok: false, error: "Dispositivo no autorizado" }, { status: 403 });
  }

  const challenge = await prisma.webAuthnChallenge.findFirst({
    where: { userId: user.id, kind: "authenticate", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return NextResponse.json({ ok: false, error: "Challenge expirado" }, { status: 400 });

  const verification = await verifyAuthenticationResponse({
    response: assertion,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: Buffer.from(cred.credentialId).toString("base64url"),
      publicKey: new Uint8Array(cred.publicKey),
      counter: Number(cred.counter),
      transports: cred.transports as AuthenticatorTransport[] | undefined,
    },
  });

  if (!verification.verified) {
    return NextResponse.json({ ok: false, error: "Verificación fallida" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.webAuthnCredential.update({
      where: { id: cred.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    }),
    prisma.webAuthnChallenge.delete({ where: { id: challenge.id } }),
  ]);

  await recordAudit({ actorId: user.id, action: "webauthn.authenticate", subjectId: user.id });
  return NextResponse.json({ ok: true });
}
