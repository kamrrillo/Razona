import { execSync } from "node:child_process";

/** Reinicia a Ana antes de correr el guion (requiere Supabase local y .env.local). */
export default function globalSetup() {
  if (process.env.E2E_SKIP_SEED === "true") return;
  execSync("pnpm seed:demo", { stdio: "inherit" });
}
