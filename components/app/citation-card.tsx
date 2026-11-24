import { BookOpenCheck, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  gpcId: string;
  gpcTitle?: string;
  section: string;
  /** Página del PDF de la GPC. */
  page?: number;
  snippet: string;
  /** PDF público de la GPC (json/fuentes: `url`). Si existe, se enlaza en la página citada. */
  pdfUrl?: string;
  className?: string;
};

/** Enlace al PDF abierto en la página citada (`#page=N` lo respetan los visores de PDF). */
export function gpcPdfHref(pdfUrl: string | undefined, page?: number): string | null {
  if (!pdfUrl || !/^https:\/\//.test(pdfUrl)) return null;
  return page ? `${pdfUrl.split("#")[0]}#page=${page}` : pdfUrl;
}

export function CitationCard({
  gpcId,
  gpcTitle,
  section,
  page,
  snippet,
  pdfUrl,
  className,
}: Props) {
  const href = gpcPdfHref(pdfUrl, page);
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
            {page ? ` · p. ${page}` : ""}
          </span>
        </span>
      </figcaption>
      <blockquote className="text-foreground/90">«{snippet}»</blockquote>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="citation-pdf"
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-primary ring-1 ring-primary/30 transition-colors hover:bg-primary/10"
        >
          <FileText className="size-3.5" aria-hidden />
          Abrir la GPC (PDF){page ? `, p. ${page}` : ""}
        </a>
      )}
    </figure>
  );
}
