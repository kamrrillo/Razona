"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type EstudioState, startParticipant } from "./actions";

export function NameForm({ signedInAs }: { signedInAs?: string }) {
  const [state, action, pending] = useActionState<EstudioState, FormData>(startParticipant, {});
  return (
    <form action={action} noValidate className="space-y-4" data-testid="estudio-name-form">
      <div className="space-y-2">
        <Label htmlFor="name">¿Cómo te llamas?</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={60}
          className="h-12 text-base"
        />
        <p className="text-xs text-muted-foreground">
          Guardamos tu nombre y tus respuestas para el estudio. No necesitas correo ni contraseña.
        </p>
      </div>
      {signedInAs && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          En este teléfono hay una sesión abierta ({signedInAs}). Al continuar se cierra y empieza
          un registro nuevo.
        </p>
      )}
      {state.error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Un momento…" : "Continuar"}
      </Button>
    </form>
  );
}
