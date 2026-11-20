import { useId } from "react";
import { cn } from "@/lib/utils";

/** Marca de Razona: línea de pulso que termina en una palomita (razonar → acertar). */
export function LogoMark({ className, title = "Razona" }: { className?: string; title?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={cn("size-10", className)} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b7d9a" />
          <stop offset="0.55" stopColor="#0f9bb8" />
          <stop offset="1" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id}-g)`} />
      <path
        d="M11 35h9l4.5-8.5 6 16 5.5-12 4 5.5L52 21"
        fill="none"
        stroke="#fff"
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="52" cy="13.5" r="3.6" fill="#a7f3e4" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      <span className="text-xl font-extrabold tracking-tight text-brand-900">
        Razon<span className="text-aqua-500">a</span>
      </span>
    </span>
  );
}
