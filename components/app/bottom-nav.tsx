"use client";

import { BarChart3, Map as MapIcon, Stethoscope, Timer } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/inicio", label: "Inicio", icon: MapIcon },
  { href: "/practicar", label: "Practicar", icon: Stethoscope },
  { href: "/examen", label: "Examen", icon: Timer },
  { href: "/progreso", label: "Progreso", icon: BarChart3 },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-brand-100 bg-white/95 backdrop-blur pb-safe"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4 gap-1 px-2 py-1.5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-[11px] font-bold transition-colors",
                  active
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-transparent text-muted-foreground hover:text-brand-700",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.5 : 2} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
