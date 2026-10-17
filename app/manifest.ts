import type { MetadataRoute } from "next";
import { cfg } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: cfg.appName,
    short_name: cfg.appName,
    description: "Recovery, strain, sleep and everything on today's plate.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0b0d",
    theme_color: "#0a0b0d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
