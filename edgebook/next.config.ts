import type { NextConfig } from "next";

// Set by the GitHub Pages workflow (e.g. "/bonzstakes-v1"). Unset for local dev and Node hosts.
const basePath = process.env.PAGES_BASE_PATH ?? "";
const isStaticExport = process.env.STATIC_EXPORT === "true";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(isStaticExport
    ? {
        // GitHub Pages: plain static files, served from /<repo-name>/
        output: "export",
        basePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        // Custom headers only work on a Node host (not in a static export)
        async headers() {
          return [{ source: "/:path*", headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
