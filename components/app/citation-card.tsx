import { BookOpenCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  gpcId: string;
  gpcTitle?: string;
  section: string;
  snippet: string;
  className?: string;
};

export function CitationCard({ gpcId, gpcTitle, section, snippet, className }: Props) {
  return (
    <figure
      data-testid="citation"
      className={cn("rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm", className)}
    >
      <figcaption className="mb-1 flex items-start gap-2 font-medium text-primary">
        <BookOpenCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {gpcTitle ?? "Guía de Práctica Clínica"}
          <span className="block text-xs font-normal text-muted-foreground">
            {gpcId} · {section}
          </span>
        </span>
      </figcaption>
      <blockquote className="text-foreground/90">{snippet}</blockquote>
    </figure>
  );
}
