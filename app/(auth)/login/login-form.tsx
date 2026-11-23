"use client";

import { Eye, EyeOff, MailCheck } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { track } from "@/lib/analytics/events";
import { cn } from "@/lib/utils";
import {
  type AuthFormState,
  requestPasswordReset,
  resendConfirmation,
  signInAsDemo,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from "./actions";

export type AuthMode = "signin" | "signup" | "reset";

type Props = {
  demoMode: boolean;
  enableGoogle: boolean;
  initialError?: string;
  initialMode?: AuthMode;
  /** Página a la que iba antes de que se le pidiera entrar. */
  next?: string;
};

/**
 * Entrar, crear cuenta y recuperar contraseña. Cada modo es un componente con su propio
 * useActionState: al cambiar de modo se monta de nuevo, así que nunca queda la acción
 * o el error del modo anterior. El correo escrito se conserva entre modos.
 */
export function LoginForm({
  demoMode,
  enableGoogle,
  initialError,
  initialMode = "signin",
  next,
}: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const shared = { email, setEmail, next };

  return (
    <div className="space-y-5">
      {mode !== "reset" && (
        <fieldset className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
          <legend className="sr-only">¿Tienes cuenta?</legend>
          {(
            [
              ["signin", "Entrar"],
              ["signup", "Crear cuenta"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              data-testid={`auth-mode-${value}`}
              className={cn(
                "min-h-11 rounded-xl text-sm font-bold transition-colors",
                mode === value
                  ? "bg-white text-brand-900 shadow-sm"
                  : "text-muted-foreground hover:text-brand-800",
              )}
            >
              {label}
            </button>
          ))}
        </fieldset>
      )}

      {enableGoogle && mode !== "reset" && (
        <>
          <GoogleButton next={next} />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />o con tu correo
            <Separator className="flex-1" />
          </div>
        </>
      )}

      {mode === "signin" && (
        <SignInForm {...shared} initialError={initialError} onForgot={() => setMode("reset")} />
      )}
      {mode === "signup" && <SignUpForm {...shared} />}
      {mode === "reset" && <ResetForm {...shared} onBack={() => setMode("signin")} />}

      {demoMode && mode !== "reset" && <DemoButton />}
    </div>
  );
}

type Shared = { email: string; setEmail: (v: string) => void; next?: string };

function SignInForm({
  email,
  setEmail,
  next,
  initialError,
  onForgot,
}: Shared & { initialError?: string; onForgot: () => void }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signInWithPassword, {
    error: initialError,
  });
  return (
    <div className="space-y-4">
      <form action={action} noValidate className="space-y-4" data-testid="signin-form">
        <NextField next={next} />
        <EmailField value={email} onChange={setEmail} />
        <PasswordField autoComplete="current-password" />
        <Feedback state={state} />
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      {state.unconfirmedEmail && <ResendButton email={state.unconfirmedEmail} next={next} />}
      <button
        type="button"
        onClick={onForgot}
        className="min-h-11 w-full text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
        data-testid="forgot-password"
      >
        ¿Olvidaste tu contraseña?
      </button>
    </div>
  );
}

function SignUpForm({ email, setEmail, next }: Shared) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUpWithPassword, {});
  const [name, setName] = useState("");

  if (state.message && state.unconfirmedEmail) {
    return (
      <div className="space-y-4 text-center" data-testid="signup-check-email">
        <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
        <p className="text-lg font-bold text-brand-900">Revisa tu correo</p>
        <p className="text-sm leading-relaxed">{state.message}</p>
        <p className="text-xs text-muted-foreground">
          ¿No llega? Busca en spam o pide otro correo en un minuto.
        </p>
        <ResendButton email={state.unconfirmedEmail} next={next} />
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-4" data-testid="signup-form">
      <NextField next={next} />
      <div className="space-y-2">
        <Label htmlFor="name">¿Cómo te llamas?</Label>
        <Input
          id="name"
          name="name"
          autoComplete="given-name"
          autoCapitalize="words"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 text-base"
        />
      </div>
      <EmailField value={email} onChange={setEmail} />
      <PasswordField autoComplete="new-password" hint="Al menos 8 caracteres." />
      <Feedback state={state} />
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Creando tu cuenta…" : "Crear cuenta"}
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Guardamos tus respuestas para personalizar tu práctica. Uso educativo: no sustituye el
        criterio clínico.
      </p>
    </form>
  );
}

function ResetForm({ email, setEmail, onBack }: Shared & { onBack: () => void }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    {},
  );
  return (
    <div className="space-y-4" data-testid="reset-form">
      <div>
        <p className="text-lg font-bold text-brand-900">Recupera tu contraseña</p>
        <p className="text-sm text-muted-foreground">
          Te enviamos un enlace para elegir una nueva.
        </p>
      </div>
      <form action={action} noValidate className="space-y-4">
        <EmailField value={email} onChange={setEmail} />
        <Feedback state={state} />
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
          {pending ? "Enviando…" : "Enviar enlace"}
        </Button>
      </form>
      <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onBack}>
        Volver a entrar
      </Button>
    </div>
  );
}

function ResendButton({ email, next }: { email: string; next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(resendConfirmation, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="email" value={email} />
      <NextField next={next} />
      <Button
        type="submit"
        variant="outline"
        className="min-h-11 w-full"
        disabled={pending}
        data-testid="resend-confirmation"
      >
        {pending ? "Enviando…" : "Reenviar correo de confirmación"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

function GoogleButton({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signInWithGoogle, {});
  return (
    <form action={action} className="space-y-2">
      <NextField next={next} />
      <Button type="submit" variant="outline" size="lg" className="h-12 w-full" disabled={pending}>
        {pending ? "Abriendo Google…" : "Continuar con Google"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** El demo queda abajo y discreto: la acción principal es entrar con tu cuenta. */
function DemoButton() {
  const [state, action, pending] = useActionState<AuthFormState>(signInAsDemo, {});
  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-center text-xs text-muted-foreground">
        ¿Solo quieres ver cómo funciona? Entra con una alumna de ejemplo.
      </p>
      <form action={action} onSubmit={() => track("login_demo")}>
        <Button
          type="submit"
          variant="outline"
          className="min-h-11 w-full"
          disabled={pending}
          aria-label="Entrar como Ana (demo)"
        >
          {pending ? "Entrando…" : "Entrar como Ana (demo)"}
        </Button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

function NextField({ next }: { next?: string }) {
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

function EmailField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="email">Correo</Label>
      <Input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 text-base"
      />
    </div>
  );
}

function PasswordField({
  autoComplete,
  hint,
}: {
  autoComplete: "current-password" | "new-password";
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const hintId = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor="password">Contraseña</Label>
      <div className="relative">
        <Input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-describedby={hint ? hintId : undefined}
          className="h-11 pr-12 text-base"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-brand-700"
          data-testid="toggle-password"
        >
          {visible ? (
            <EyeOff className="size-5" aria-hidden />
          ) : (
            <Eye className="size-5" aria-hidden />
          )}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function Feedback({ state }: { state: AuthFormState }) {
  if (state.error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.message) {
    return (
      <Alert role="status">
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
