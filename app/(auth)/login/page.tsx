import type { Metadata } from "next";
import { SampleContentBadge } from "@/components/app/sample-content-badge";
import { publicEnv } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const authError = params.error === "auth";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 pt-safe pb-safe">
      <header className="space-y-3 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
          R
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Razona</h1>
        <p className="text-muted-foreground">
          Practica casos clínicos tipo ENARM con un tutor que te hace pensar y cita las GPC.
        </p>
      </header>

      <LoginForm
        demoMode={publicEnv.demoMode}
        enableGoogle={publicEnv.enableGoogle}
        initialError={authError ? "No se pudo completar el inicio de sesión." : undefined}
      />

      <footer className="space-y-2 text-center text-xs text-muted-foreground">
        <p>Demo — uso educativo, no sustituye el criterio clínico.</p>
        <SampleContentBadge />
      </footer>
    </main>
  );
}
