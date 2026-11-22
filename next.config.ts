import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/** IPs IPv4 de la red local de esta máquina, para abrir el servidor de desarrollo desde el teléfono. */
function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net?.address as string);
}

const nextConfig: NextConfig = {
  // Solo aplica en `next dev`: permite cargar la app desde otro dispositivo en la misma red.
  allowedDevOrigins: lanAddresses(),
  // El indicador de Next.js tapa la navegación inferior en el teléfono (y los clics de Playwright).
  devIndicators: false,
  // ADK tiene dependencias opcionales (GCP) que no deben empaquetarse: se carga en runtime desde node_modules.
  serverExternalPackages: ["@google/adk", "@google/genai"],
  // Las imágenes de los recursos se leen del banco (json/assets) en /recursos/[archivo].
  outputFileTracingIncludes: {
    "/recursos/*": ["./json/assets/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
