# Razona · demo

"El LeetCode del ENARM": casos clínicos tipo ENARM con un tutor socrático (Google ADK + Gemini) que cita las Guías de Práctica Clínica, examen simulado y progreso.

> **Es un demo, no un producto.** Demo — uso educativo, no sustituye el criterio clínico.
> El contenido clínico es el **banco de casos de pediatría** (`json/`): 110 casos tipo ENARM basados en 55 GPC del CENETEC/IMSS, con rúbrica de errores y citas con página.

## Guion (90 s)

1. Escanear el QR → `/login` → **Entrar como Ana (demo)**.
2. **Inicio**: racha, avance por área y tema débil (Bronquiolitis aguda).
3. **Practicar mi tema débil** (caso RZ-PED-032-I) → elegir **a)** → el tutor pregunta y cita la GPC con página.
4. Elegir **e)** → feedback con explicación y cita.
5. **Examen** → global, por área o por tema → Comenzar → responder 2 → **Completar examen (demo)**.
6. **Resultados**: calificación, aciertos por área, revisión con el tipo de error y su cita, **Practicar mi tema débil**.
7. **Progreso**: la racha sube (6 → 7) y el tema débil mejora.

Antes de cada ensayo o del pitch: `pnpm seed:demo` (reinicia a Ana).

## Desarrollo local

Requisitos: Node 24, pnpm, Docker (o Podman con `DOCKER_HOST`), Supabase CLI y uv.

```bash
pnpm install
supabase start          # API en http://127.0.0.1:55321
cp .env.example .env.local   # y completa con `supabase status`
pnpm content:load       # carga el banco de casos (json/) en Supabase
pnpm seed:demo          # crea a Ana con historial sobre el banco
pnpm dev --port 3100
```

| Script | Qué hace |
|---|---|
| `pnpm verify` | typecheck + lint (Biome) + tests (Vitest) |
| `pnpm test:e2e` | Guion completo en viewport de iPhone (Playwright; reinicia a Ana) |
| `pnpm content:load` | Valida y carga `json/casos` + `json/temas.json` en Supabase (idempotente; `content:load:prod` para producción) |
| `pnpm seed:demo` | Reinicia a Ana con historial sobre el banco (idempotente) |
| `pnpm db:reset` | Reaplica migraciones y seed de especialidades |
| `pnpm db:types` | Regenera `lib/supabase/database.types.ts` |

## Estructura

```
app/(auth)/login          Login (correo, Ana demo, Google opcional)
app/(app)/{inicio,practicar,examen,progreso}
app/api/*                 Route handlers validados con Zod (entrada y salida)
app/auth/{callback,logout}
lib/schemas               Contratos Zod (contenido, API, eventos SSE)
lib/ai                    TutorEngine: ADK, respaldo, resiliente (timeout 6 s), SSE
lib/learning              Racha, estadísticas, Thompson sampling
lib/data                  Acceso a datos (RLS con la sesión de la usuaria)
lib/supabase              Clientes server / proxy / admin (service role, server-only)
lib/analytics/events.ts   PostHog (no hace nada sin clave)
json/                     Banco de casos (fuente del contenido) y su catálogo de temas
supabase/migrations       Esquema + RLS (banco: casos_clinicos, temas, vistas v_casos_*)
scripts/seed-demo.ts      Ana y su historial sintético
tests/{unit,e2e}
docs/DECISIONES.md
```

## Agente en Python (ADK)

`agent/` contiene un sistema multiagente con **Google ADK para Python** (coordinador + agente de diagnóstico + agente de preparación + tutor socrático) que lee y escribe en la misma base de Supabase. Solo necesita `GOOGLE_API_KEY`:

```bash
cd agent && uv sync && export GOOGLE_API_KEY=tu-clave
uv run adk web                          # UI de ADK → razona_agent
uv run python -m razona_agent.cli       # chat en la terminal como Ana
uv run pytest                           # pruebas (sin clave)
```

**Conectado a la app web:** la pestaña Examen tiene "Diagnóstico con IA" (`/diagnostico`). Para usarlo, corre el servidor del agente junto a la app y define `AGENT_API_URL` y `AGENT_API_TOKEN` en `.env.local`:

```bash
cd agent && uv run python -m razona_agent.server --port 8080
```

Sin clave de Gemini el diagnóstico funciona igual (sin la narración del agente).

Detalles, arquitectura y decisiones: [agent/README.md](agent/README.md).

## Reemplazar el contenido

El contenido es el banco de casos de `json/` (ver `json/README.md`). No hay que tocar código:

1. Edita o agrega casos en `json/fuentes/` y reconstruye con `python3 json/herramientas/construir_casos.py`.
2. Si hay un tema nuevo, agrégalo a `json/temas.json` (nombre y área).
3. `pnpm content:load` valida y carga en Supabase. La app y el agente lo ven en unos minutos (caché de `CONTENT_CACHE_MS`, 5 min); el agente de Python, al reiniciarse.

Cómo fluye: `json/casos` → `casos_clinicos.payload` (tal cual) → vista `v_casos_app` (formato `Item`) → app web y agente. La rúbrica solo se lee desde el servidor; el tutor de respaldo usa sus preguntas socráticas semilla. Una especialidad nueva se agrega en `supabase/seed/01_specialties.sql` y en los grupos de `json/temas.json`.

## Deploy (Vercel + Supabase)

Producción actual (20 nov 2026):

| Pieza | Dónde |
|---|---|
| App web | https://razona.vercel.app (proyecto Vercel `razona`, equipo MetricLabs) |
| Agente Python | https://razona-agent.vercel.app (proyecto Vercel `razona-agent`, raíz `agent/`, FastAPI) |
| Base de datos | Supabase `razona` (`qyuhajjhgtkrerauwpax`, us-east-1) |

Las variables de producción viven en `.env.vercel.local` y `agent/.env.vercel.local` (ignorados por git) y ya están cargadas en cada proyecto de Vercel. Para repetir el despliegue:

1. **Supabase**: `supabase link --project-ref <ref>` y `supabase db push --include-seed` (migraciones + especialidades). Las URLs de Auth están en `[remotes.production]` de `supabase/config.toml`: `supabase config push --project-ref <ref>`.
2. **Agente** (`cd agent`): `vercel link --project razona-agent`, variables de `agent/.env.example` (incluida `ADK_SESSIONS_DB_URL`, el *session pooler* de Supabase) y `vercel deploy --prod`. Vercel detecta FastAPI por `agent/index.py`.
3. **App web** (raíz): `vercel link --project razona`, variables de `.env.example` con `AGENT_API_URL=https://razona-agent.vercel.app` y el mismo `AGENT_API_TOKEN`, y `vercel deploy --prod`. `.vercelignore` deja fuera `agent/` y los `.env*`.
4. **Ana en producción**: `pnpm seed:prod` (usa `.env.vercel.local`).
5. Genera el QR apuntando a `https://razona.vercel.app/login`.

## Checklist del día del pitch

- [ ] `pnpm seed:prod` la mañana del pitch: la racha cuenta días hasta *ayer*, así que hay que resembrar el mismo día.
- [ ] Probar el guion completo una vez en el teléfono que se usará.
- [ ] Con y sin `GOOGLE_GENAI_API_KEY` el guion funciona (sin clave usa el tutor de respaldo).
- [ ] Si la red falla: el tutor de respaldo responde en <1 s.
