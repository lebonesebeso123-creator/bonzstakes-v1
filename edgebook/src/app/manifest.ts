import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BonzStakes",
    short_name: "BonzStakes",
    description: "Match research and paper bet tracker",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [{ src: `${base}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
