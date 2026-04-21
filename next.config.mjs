import createMDX from "@next/mdx";
import pkg from "./package.json" with { type: "json" };

const withMDX = createMDX({});

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default withMDX(nextConfig);
