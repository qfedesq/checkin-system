import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rpID } from "@/lib/webauthn";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { route } from "@/lib/route";

export const POST = route("webauthn.authenticate.options", async (req: NextRequest) => {
  // Rate-limit: si hay sesión (flujo de fichaje) keyeamos por USUARIO, no por IP — en un
  // lugar de trabajo todos los empleados comparten la misma IP (NAT) y el límite por IP
  // bloqueaba fichajes simultáneos legítimos. Sin sesión (login) seguimos por IP para
  // frenar enumeración de emails / fuerza bruta.
  const session = await auth();
  const rlKey = session?.user?.id
    ? `webauthn-auth-options:user:${session.user.id}`
    : `webauthn-auth-options:ip:${getClientIp(req)}`;
  const rl = checkRateLimit(rlKey);
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
