import "server-only";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { origin, rpID, deviceHashFromCredentialId } from "@/lib/webauthn";

export type AssertionResult = { ok: true } | { ok: false; status: number; error: string };

// Verifica una aserción WebAuthn (biometría) del usuario contra su credencial y un challenge
// vigente kind:"authenticate". Es la MISMA lógica que /api/webauthn/authenticate/verify (login),
// extraída para poder exigir biometría verificada del lado del servidor DENTRO del propio
// endpoint de check-in/out — antes verify y checkin eran requests separados y no vinculados,
// así que con una sesión válida se podía saltear la biometría pegándole directo a /attendance.
// Consume el challenge (lo borra) y actualiza el counter, igual que el flujo de login.
export async function verifyUserAssertion(userId: string, assertion: unknown): Promise<AssertionResult> {
  const a = assertion as { id?: string } | null | undefined;
  if (!a?.id) return { ok: false, status: 400, error: "Falta la verificación biométrica" };

  const credentialIdBuf = Buffer.from(a.id, "base64url");
  const cred = await prisma.webAuthnCredential.findUnique({ where: { credentialId: credentialIdBuf } });
  if (!cred || cred.userId !== userId) {
    return { ok: false, status: 403, error: "Dispositivo no autorizado para este usuario" };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, status: 404, error: "Usuario no encontrado" };

  const deviceId = deviceHashFromCredentialId(credentialIdBuf);
  if (user.deviceId && user.deviceId !== deviceId) {
    return { ok: false, status: 403, error: "Dispositivo no autorizado" };
  }

  const challenge = await prisma.webAuthnChallenge.findFirst({
    where: { userId, kind: "authenticate", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { ok: false, status: 400, error: "Verificación expirada, probá de nuevo" };

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
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
  } catch {
    return { ok: false, status: 400, error: "Verificación biométrica fallida" };
  }

  if (!verification.verified) return { ok: false, status: 400, error: "Verificación biométrica fallida" };

  await prisma.$transaction([
    prisma.webAuthnCredential.update({
      where: { id: cred.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    }),
    prisma.webAuthnChallenge.delete({ where: { id: challenge.id } }),
  ]);

  return { ok: true };
}
