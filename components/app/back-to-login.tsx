import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CLASS =
  "flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-semibold text-brand-700 underline-offset-4 hover:underline";

/**
 * Salida del estudio hacia el login. Con `signOut` cierra antes la sesión de la participante
 * (si no, el login la regresaría a /estudio).
 */
export function BackToLogin({
  signOut = false,
  className,
}: {
  signOut?: boolean;
  className?: string;
}) {
  const content = (
    <>
      <ArrowLeft className="size-4" aria-hidden /> Volver al inicio de sesión
    </>
  );
  if (!signOut) {
    return (
      <Link href="/login" className={cn(CLASS, className)} data-testid="back-to-login">
        {content}
      </Link>
    );
  }
  return (
    <form action="/auth/logout" method="post" className={className}>
      <input type="hidden" name="to" value="login" />
      <button type="submit" className={CLASS} data-testid="back-to-login">
        {content}
      </button>
    </form>
  );
}
