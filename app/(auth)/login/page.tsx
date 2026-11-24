import {
  BookOpenCheck,
  ChevronRight,
  ClipboardList,
  ListChecks,
  MessageCircleQuestion,
  Route,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/app/logo";
import { Separator } from "@/components/ui/separator";
import { safeNextPath } from "@/lib/auth/next-path";
import { publicEnv } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const FEATURES = [
  { icon: Route, text: "Una ruta de casos que prioriza tu tema débil" },
  { icon: MessageCircleQuestion, text: "Un tutor que pregunta en vez de darte la respuesta" },
  { icon: BookOpenCheck, text: "Cada retroalimentación cita la GPC" },
];

/** Versión de solo cuestionario (grupo control del estudio): no menciona el tutor. */
const FEATURES_CONTROL = [
  { icon: Route, text: "Casos clínicos tipo ENARM de pediatría" },
  { icon: ListChecks, text: "Examen simulado por área o por tema" },
  { icon: BookOpenCheck, text: "Cada respuesta se explica con la GPC" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const authError = params.error === "auth";
  const next = safeNextPath(params.next, "");
  const initialMode = params.modo === "registro" ? "signup" : "signin";
  const control = params.grupo === "control";
  const features = control ? FEATURES_CONTROL : FEATURES;
  return (
    <main className="flex min-h-dvh flex-col">
      <section className="relative overflow-hidden bg-brand-gradient px-6 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-16 text-white">
        <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-aqua-300/20" />
        <div className="relative mx-auto max-w-md text-center">
          <span className="mx-auto inline-flex rounded-[30px] bg-white/90 p-2 shadow-[0_6px_0_0_rgb(8_44_59/0.25)]">
            <LogoMark className="size-20" />
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight">
            Razon<span className="text-aqua-200">a</span>
          </h1>
          <p className="mt-2 text-brand-50">Prepara el ENARM razonando casos clínicos.</p>
        </div>
      </section>

      <div className="relative mx-auto -mt-10 w-full max-w-md flex-1 px-4 pb-safe">
        <div className="space-y-6 rounded-3xl border-2 border-brand-100 bg-white p-5 shadow-[0_6px_0_0_var(--color-brand-100)]">
          <ul className="space-y-2">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-brand-900">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-aqua-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
          {!control && (
            <>
              <Link
                href="/estudio"
                data-testid="go-estudio"
                className="flex min-h-16 items-center gap-3 rounded-2xl bg-brand-gradient p-4 text-white shadow-[0_5px_0_0_var(--color-brand-800)] transition-transform active:translate-y-1"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <ClipboardList className="size-6" aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block font-bold">Participar en el estudio</span>
                  <span className="block text-sm text-brand-50">
                    Entra solo con tu nombre, sin correo ni contraseña
                  </span>
                </span>
                <ChevronRight className="size-5" aria-hidden />
              </Link>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Separator className="flex-1" />o entra con tu cuenta
                <Separator className="flex-1" />
              </div>
            </>
          )}
          <LoginForm
            demoMode={publicEnv.demoMode}
            enableGoogle={publicEnv.enableGoogle}
            initialError={
              authError
                ? "El enlace no funcionó o ya expiró. Entra de nuevo o pide otro correo."
                : undefined
            }
            initialMode={initialMode}
            next={next || undefined}
            control={control}
          />
        </div>

        <footer className="space-y-2 py-6 text-center text-xs text-muted-foreground">
          <p>Demo — uso educativo, no sustituye el criterio clínico.</p>
        </footer>
      </div>
    </main>
  );
}
