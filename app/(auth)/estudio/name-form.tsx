"use client";

import { useActionState, useState } from "react";
import { StudyAgreement } from "@/components/app/study-agreement";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type EstudioState, startParticipant } from "./actions";

/** Paso 1 del estudio: nombre y aceptación del acuerdo (sin ella no se crea la participante). */
export function NameForm({ signedInAs }: { signedInAs?: string }) {
  const [state, action, pending] = useActionState<EstudioState, FormData>(startParticipant, {});
  // Controlados: React reinicia el formulario después de la acción y no queremos perderlos.
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 text-base"
        />
      </div>

      <section className="space-y-3 rounded-2xl border bg-muted/40 p-4" aria-labelledby="acuerdo">
        <h3 id="acuerdo" className="font-bold text-brand-900">
          Acuerdo de confidencialidad y uso de datos
        </h3>
        <StudyAgreement />
        <label className="flex min-h-11 cursor-pointer items-start gap-3 pt-1 text-sm font-semibold">
          <input
            type="checkbox"
            name="consent"
            value="si"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand-700)]"
            data-testid="study-consent"
          />
          Leí el acuerdo y acepto participar.
        </label>
      </section>

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
      <Button
        type="submit"
        size="lg"
        className="h-12 w-full text-base"
        disabled={pending || !consent}
      >
        {pending ? "Un momento…" : "Continuar"}
      </Button>
    </form>
  );
}
