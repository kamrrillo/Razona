import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ADK tiene dependencias opcionales (GCP) que no deben empaquetarse: se carga en runtime desde node_modules.
  serverExternalPackages: ["@google/adk", "@google/genai"],
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
