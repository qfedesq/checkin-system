import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { rpID } from "@/lib/webauthn";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { route } from "@/lib/route";

export const POST = route("webauthn.authenticate.options", async (req: NextRequest) => {
  // Best-effort por IP: frena enumeración de emails / fuerza bruta contra
  // este endpoint público (sin sesión). Ver src/lib/rate-limit.ts sobre la
  // limitación en serverless multi-instancia.
  const rl = checkRateLimit(`webauthn-auth-options:${getClientIp(req)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
      { status: 429, headers: rl.retryAfterSec ? { "Retry-After": String(rl.retryAfterSec) } : undefined },
    );
  }

  const { email } = await req.json();
  const user = await prisma.user.findUnique({
    where: { email: (email ?? "").toLowerCase() },
    include: { webauthnCredentials: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Usuario no válido" }, { status: 404 });
  }

  if (user.webauthnCredentials.length === 0) {
    return NextResponse.json({ needsEnrollment: true });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: user.webauthnCredentials.map((c) => ({
      id: Buffer.from(c.credentialId).toString("base64url"),
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
  });

  await prisma.webAuthnChallenge.create({
    data: {
      userId: user.id,
      challenge: options.challenge,
      kind: "authenticate",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return NextResponse.json(options);
});
