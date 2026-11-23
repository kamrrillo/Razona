import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/app/logo";
import { getAuthedContext } from "@/lib/data/auth";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

/** Se llega desde el enlace de recuperación: /auth/callback ya abrió la sesión. */
export default async function RestablecerPage() {
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login?error=auth");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="space-y-5 rounded-3xl border-2 border-brand-100 bg-white p-5 shadow-[0_6px_0_0_var(--color-brand-100)]">
        <div className="flex items-center gap-3">
          <LogoMark className="size-12" />
          <div>
            <h1 className="text-xl font-extrabold text-brand-900">Elige tu contraseña nueva</h1>
            {ctx.email && <p className="text-sm text-muted-foreground">{ctx.email}</p>}
          </div>
        </div>
        <NewPasswordForm />
      </div>
    </main>
  );
}
