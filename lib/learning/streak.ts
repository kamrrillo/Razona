export const DEMO_TIME_ZONE = "America/Mexico_City";

/** Fecha local (YYYY-MM-DD) en la zona horaria dada. */
export function localDay(date: Date, timeZone = DEMO_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type Streak = {
  current: number;
  activeToday: boolean;
  /** Últimos 7 días (más antiguo primero) con actividad sí/no. */
  lastSevenDays: { day: string; active: boolean }[];
};

/**
 * Racha: días consecutivos con actividad. Si hoy aún no hay actividad,
 * la racha sigue viva contando desde ayer.
 */
export function computeStreak(activityDates: Date[], now: Date, timeZone = DEMO_TIME_ZONE): Streak {
  const days = new Set(activityDates.map((d) => localDay(d, timeZone)));
  const today = localDay(now, timeZone);
  const activeToday = days.has(today);

  let cursor = activeToday ? today : previousDay(today);
  let current = 0;
  while (days.has(cursor)) {
    current += 1;
    cursor = previousDay(cursor);
  }

  const lastSevenDays: { day: string; active: boolean }[] = [];
  let d = today;
  for (let i = 0; i < 7; i++) {
    lastSevenDays.unshift({ day: d, active: days.has(d) });
    d = previousDay(d);
  }

  return { current, activeToday, lastSevenDays };
}
