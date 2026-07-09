import createMDX from "@next/mdx";
import pkg from "./package.json" with { type: "json" };

const withMDX = createMDX({});

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  // QA-045: hay un lockfile ajeno a este repo más arriba en el árbol de directorios
  // (p.ej. ~/package-lock.json); sin esto Next infiere mal el workspace root y tira warning.
  outputFileTracingRoot: import.meta.dirname,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  // QA-037: headers de seguridad básicos, sin CSP.
  // No agregamos Content-Security-Policy: la app tiene un service worker propio (sw.js)
  // para push, next/font con @font-face self-hosted, y llamadas a Vercel Blob a través
  // de un proxy propio — armar una CSP correcta requeriría mapear connect-src/script-src
  // con cuidado (incluyendo lo que inyecta Next en runtime) para no romper push o
  // check-in en producción sin poder probarlo con datos reales. Se deja pendiente como
  // ítem aparte con testing dedicado.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // geolocation: usado por check-in/check-out. publickey-credentials-get/create:
          // usado por WebAuthn. No los bloqueamos. camera/microphone no se usan hoy.
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), camera=(), microphone=(), publickey-credentials-get=(self), publickey-credentials-create=(self)",
          },
        ],
      },
    ];
  },
};

export default withMDX(nextConfig);
