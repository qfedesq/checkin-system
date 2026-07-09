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
};

export default withMDX(nextConfig);
