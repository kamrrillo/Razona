"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { track } from "@/lib/analytics/events";
import {
  type AuthFormState,
  signInAsDemo,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from "./actions";

type Props = { demoMode: boolean; enableGoogle: boolean; initialError?: string };

export function LoginForm({ demoMode, enableGoogle, initialError }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    mode === "signin" ? signInWithPassword : signUpWithPassword,
    { error: initialError },
  );
  const [demoState, demoAction, demoPending] = useActionState<AuthFormState>(signInAsDemo, {});
  const [googleState, googleAction, googlePending] = useActionState<AuthFormState>(
    signInWithGoogle,
    {},
  );
  const error = state.error ?? demoState.error ?? googleState.error;

  return (
    <div className="space-y-6">
      {demoMode && (
        <form action={demoAction} onSubmit={() => track("login_demo")}>
          <Button type="submit" size="lg" className="h-14 w-full text-lg" disabled={demoPending}>
            {demoPending ? "Entrando…" : "Entrar como Ana (demo)"}
          </Button>
        </form>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {state.message && (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {demoMode && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Separator className="flex-1" />o con tu cuenta
          <Separator className="flex-1" />
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={8}
            required
            className="h-11"
          />
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={pending}>
          {mode === "signin" ? "Entrar" : "Crear cuenta"}
        </Button>
      </form>

      {enableGoogle && (
        <form action={googleAction}>
          <Button type="submit" variant="outline" className="w-full" disabled={googlePending}>
            Continuar con Google
          </Button>
        </form>
      )}

      <Button
        type="button"
        variant="link"
        className="w-full"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Entra"}
      </Button>
    </div>
  );
}
