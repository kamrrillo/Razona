import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { type AuthedContext, getAuthedContext } from "@/lib/data/auth";
import { ExamClosedError, NotFoundError } from "@/lib/data/exam";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireAuth(): Promise<AuthedContext> {
  const ctx = await getAuthedContext();
  if (!ctx) throw new HttpError(401, "No autenticada");
  return ctx;
}

export async function parseJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "JSON inválido");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Solicitud inválida");
  return parsed.data;
}

/** Valida la salida con Zod antes de responder. */
export function ok<S extends z.ZodType>(schema: S, data: z.input<S>, init?: ResponseInit) {
  return NextResponse.json(schema.parse(data), init);
}

export function handleError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ExamClosedError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  console.error("[api]", error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
