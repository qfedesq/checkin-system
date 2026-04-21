import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rpID, rpName } from "@/lib/webauthn";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const existing = await prisma.webAuthnCredential.findMany({ where: { userId: session.user.id } });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(session.user.id),
    userName: session.user.email,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
    excludeCredentials: existing.map((c) => ({
      id: Buffer.from(c.credentialId).toString("base64url"),
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
  });

  await prisma.webAuthnChallenge.create({
    data: {
      userId: session.user.id,
      challenge: options.challenge,
      kind: "register",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return NextResponse.json(options);
}
