/**
 * Crea (o reinicia) a Ana, la usuaria de la demo, con historial sintético.
 *
 *   pnpm seed:demo
 *
 * Requiere el banco de casos cargado en Supabase:
 *   uv run json/herramientas/cargar_supabase.py
 *
 * Idempotente: se puede correr varias veces. Cada corrida:
 *  1. Lee los casos del banco (vista v_casos_app).
 *  2. Crea a Ana con correo confirmado (o actualiza su contraseña si ya existe).
 *  3. Borra su actividad previa y regenera la racha (6 días hasta ayer),
 *     intentos por tema (Bronquiolitis aguda como tema débil) y un examen anterior.
 *
 * Usa la service role: SOLO en local o en un entorno de confianza, nunca en el cliente.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { createClient } from "@supabase/supabase-js";
import { localDay } from "@/lib/learning/streak";
import { type Item, ItemSchema } from "@/lib/schemas/content";
import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.DEMO_USER_EMAIL;
const password = process.env.DEMO_USER_PASSWORD;

if (!url || !secret || !email || !password) {
  console.error(
    "Faltan variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY), DEMO_USER_EMAIL, DEMO_USER_PASSWORD",
  );
  process.exit(1);
}

const admin = createClient<Database>(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Historial sintético por tema del banco: aciertos y total. Bronquiolitis aguda queda como tema débil. */
const SYNTHETIC_HISTORY: { topic: string; correct: number; total: number }[] = [
  { topic: "Bronquiolitis aguda", correct: 2, total: 9 },
  { topic: "Infección de vías urinarias", correct: 7, total: 9 },
  { topic: "Otitis media aguda", correct: 6, total: 8 },
  { topic: "Diarrea aguda", correct: 5, total: 6 },
  { topic: "Ictericia neonatal", correct: 4, total: 6 },
  { topic: "Laringotraqueítis aguda", correct: 3, total: 4 },
];
const STREAK_DAYS = 6; // días consecutivos hasta ayer; hoy la demo la sube a 7
const PREVIOUS_EXAM_DAYS_AGO = 3;
/** Reactivos del examen anterior que Ana falló (el resto, acertados). */
const PREVIOUS_EXAM_WRONG_TOPICS = new Set(["Bronquiolitis aguda", "Ictericia neonatal"]);

let items: Item[] = [];

/** Fecha en Ciudad de México (UTC-6, sin horario de verano) `daysAgo` días atrás a la hora dada. */
function mxDate(daysAgo: number, hour: number, minute: number): Date {
  const today = localDay(new Date());
  const base = new Date(`${today}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() - daysAgo);
  const day = base.toISOString().slice(0, 10);
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${day}T${hh}:${mm}:00-06:00`);
}

async function must<T>(
  label: string,
  promise: PromiseLike<{ data: T; error: unknown } | { data: unknown; error: unknown }>,
): Promise<T> {
  const { data, error } = (await promise) as { data: T; error: unknown };
  if (error) {
    console.error(`✗ ${label}`, error);
    process.exit(1);
  }
  return data;
}

async function loadBank() {
  const { data, error } = await admin.from("v_casos_app").select("id, payload").order("id");
  if (error) {
    console.error("✗ No se pudo leer v_casos_app. ¿Aplicaste las migraciones?", error);
    process.exit(1);
  }
  items = (data ?? []).map((row) => ItemSchema.parse(row.payload));
  if (items.length === 0) {
    console.error("✗ No hay casos. Carga el banco: uv run json/herramientas/cargar_supabase.py");
    process.exit(1);
  }
  console.log(`✓ Banco de casos: ${items.length} casos`);
}

async function ensureAna(): Promise<string> {
  const target = (email as string).toLowerCase();
  let userId: string | undefined;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === target)?.id;
    if (data.users.length < 200) break;
  }

  if (userId) {
    await must(
      "actualizar Ana",
      admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { display_name: "Ana" },
      }),
    );
    console.log("✓ Ana ya existía (contraseña actualizada)");
  } else {
    const created = await must<{ user: { id: string } | null }>(
      "crear Ana",
      admin.auth.admin.createUser({
        email: target,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Ana" },
      }),
    );
    userId = created.user?.id;
    console.log("✓ Ana creada");
  }
  if (!userId) throw new Error("No se pudo obtener el id de Ana");

  await must(
    "perfil",
    admin.from("profiles").upsert({ id: userId, display_name: "Ana" }, { onConflict: "id" }),
  );
  return userId;
}

function itemForTopic(topic: string) {
  const item = items.find((i) => i.topic === topic && i.tipo !== "variante");
  if (!item) throw new Error(`No hay caso índice para el tema ${topic}`);
  return item;
}

/** Examen anterior: el primer caso índice de cada área, más el tema débil. */
function previousExamItems(): Item[] {
  const indices = items.filter((i) => i.tipo !== "variante");
  const picked = new Map<string, Item>();
  for (const i of indices) {
    const area = i.groupId ?? i.specialtyId;
    if (!picked.has(area)) picked.set(area, i);
  }
  const list = [...picked.values()];
  for (const topic of PREVIOUS_EXAM_WRONG_TOPICS) {
    if (!list.some((i) => i.topic === topic)) list.push(itemForTopic(topic));
  }
  return list.slice(0, 10);
}

async function resetHistory(userId: string) {
  // Borrado en orden (exam_answers cae en cascada con exams).
  await must("borrar intentos", admin.from("attempts").delete().eq("user_id", userId));
  await must("borrar sesiones", admin.from("study_sessions").delete().eq("user_id", userId));
  await must("borrar exámenes", admin.from("exams").delete().eq("user_id", userId));

  // Intentos repartidos de forma determinista en los últimos STREAK_DAYS días (hasta ayer).
  const flat = SYNTHETIC_HISTORY.flatMap(({ topic, correct, total }) =>
    Array.from({ length: total }, (_, i) => ({ topic, isCorrect: i < correct })),
  );
  const attempts = flat.map((a, index) => {
    const item = itemForTopic(a.topic);
    const daysAgo = 1 + (index % STREAK_DAYS);
    const createdAt = mxDate(daysAgo, 9 + (index % 11), (index * 7) % 60);
    return {
      user_id: userId,
      session_id: null,
      item_id: item.id,
      specialty_id: item.specialtyId,
      topic: item.topic,
      selected_option: a.isCorrect
        ? item.correctOptionId
        : (item.options.find((o) => o.id !== item.correctOptionId)?.id ?? "a"),
      is_correct: a.isCorrect,
      used_tutor: !a.isCorrect,
      created_at: createdAt.toISOString(),
    };
  });
  await must("insertar intentos", admin.from("attempts").insert(attempts));

  // Examen anterior ya calificado.
  const startedAt = mxDate(PREVIOUS_EXAM_DAYS_AGO, 20, 0);
  const finishedAt = new Date(startedAt.getTime() + 13 * 60 * 1000);
  const examItems = previousExamItems();
  const answers = examItems.map((item) => {
    const selected = PREVIOUS_EXAM_WRONG_TOPICS.has(item.topic)
      ? (item.options.find((o) => o.id !== item.correctOptionId)?.id ?? "a")
      : item.correctOptionId;
    return { item, selected, isCorrect: selected === item.correctOptionId };
  });
  const correct = answers.filter((a) => a.isCorrect).length;
  const exam = await must<{ id: string }>(
    "examen previo",
    admin
      .from("exams")
      .insert({
        user_id: userId,
        exam_key: "simulacro-global",
        scope: "global",
        item_ids: examItems.map((i) => i.id),
        duration_seconds: examItems.length * 90,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        total: answers.length,
        correct,
        score: Math.round((correct / answers.length) * 10000) / 100,
      })
      .select("id")
      .single(),
  );
  await must(
    "respuestas examen previo",
    admin.from("exam_answers").insert(
      answers.map((a, i) => ({
        exam_id: exam.id,
        user_id: userId,
        item_id: a.item.id,
        specialty_id: a.item.specialtyId,
        topic: a.item.topic,
        selected_option: a.selected,
        is_correct: a.isCorrect,
        answered_at: new Date(startedAt.getTime() + (i + 1) * 70 * 1000).toISOString(),
      })),
    ),
  );

  console.log(
    `✓ Historial: ${attempts.length} intentos en ${STREAK_DAYS} días, examen previo ${correct}/${answers.length}`,
  );
}

async function main() {
  await loadBank();
  itemForTopic("Bronquiolitis aguda");
  const userId = await ensureAna();
  await resetHistory(userId);
  console.log(`✓ Demo lista: ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
