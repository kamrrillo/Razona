import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Razona · ENARM",
    short_name: "Razona",
    description: "Casos clínicos tipo ENARM con tutor socrático que cita las GPC.",
    start_url: "/inicio",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2fafc",
    theme_color: "#0b7d9a",
    lang: "es-MX",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
