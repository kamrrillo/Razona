# Decisiones

Registro de decisiones tomadas el viernes 20 nov 2026 para el demo. Ante ambigüedad se eligió lo más simple.

## Versiones verificadas (documentación del paquete instalado)

| Paquete | Versión | Nota |
|---|---|---|
| next | 16.4.6 | Desde Next 16, `middleware.ts` se llama **`proxy.ts`** (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`). |
| @supabase/ssr | 0.12.7 | `createServerClient` con `cookies.getAll`/`setAll`; `setAll` recibe además headers anti‑caché que se copian a la respuesta. |
| @google/adk | 2.5.0 | `LlmAgent`, `FunctionTool` (parámetros con Zod v4), `InMemoryRunner`, `Gemini({ model, apiKey })`. Lee `GOOGLE_GENAI_API_KEY` de forma nativa. |
| zod | 4.x | — |
| tailwindcss | 4.x | shadcn/ui 4 (base Radix). |

## Arquitectura

- **`cacheComponents` desactivado.** `create-next-app` 16 lo activa por defecto; toda la app depende de la sesión (cookies), así que se desactivó para evitar `Suspense` obligatorio y validaciones de navegación instantánea. Todas las rutas de `(app)` son dinámicas.
- **El contenido vive en JSON, no en la base.** `content/items.json`, `content/exam.json` y `content/tutor-fallback.json` se validan con Zod al cargar el módulo (si el equipo los rompe, fallan `pnpm test` y el build). La tabla `items` es un espejo que sincroniza `pnpm seed:demo`, para integridad referencial y para cumplir "los ítems los leen solo usuarios autenticados". El cliente nunca recibe la respuesta correcta ni la explicación hasta que acierta (`PublicItemSchema`).
- **El historial del tutor** se guarda en `study_sessions.messages` (jsonb). No se agregó una tabla extra para no salirnos de las 7 tablas pedidas.
- **Intentos sintéticos sin sesión.** El historial precargado de Ana tiene `attempts.session_id = null`.
- **Progreso = intentos de práctica + respuestas de exámenes terminados.** Racha, avance por especialidad y tema débil usan ambas fuentes.
- **Racha** en zona horaria `America/Mexico_City`; si hoy no hay actividad, la racha sigue viva contando desde ayer. El seed deja 6 días hasta ayer → al practicar en la demo sube a 7.
- **Tema débil** = menor media posterior Beta(1+aciertos, 1+errores) entre temas con ≥3 respuestas.
- **Thompson sampling** por tema con Beta(1+errores, 1+aciertos) y PRNG con semilla determinista (`userId` + nº de respuestas) para que la demo sea reproducible. Con el historial de Ana el tema débil sale primero >90 % de las semillas (test). Además, "Practicar mi tema débil" pide el tema explícitamente (`topic=weak`), así que en el guion nunca depende del azar.

## Tutor

- **Recolectar y luego transmitir.** El motor (ADK o respaldo) produce la respuesta completa y el route handler la emite como deltas SSE. Así el cambio a respaldo por error o por timeout (6 s, `TUTOR_TIMEOUT_MS`) es invisible: ambos se ven idénticos.
- **ADK se carga con `import()` dinámico** y está en `serverExternalPackages`: Turbopack no puede empaquetar sus dependencias opcionales de GCP. Si el módulo no carga, también cae al respaldo.
- **Un agente ADK por petición** con `InMemoryRunner`; el historial se inyecta desde Supabase en el prompt (la memoria de ADK no se usa como fuente de verdad).
- **Salvaguarda:** si la respuesta del modelo revela la opción correcta (texto de la opción o "la respuesta correcta es…"), se descarta y se usa el respaldo.
- **Eventos `hint` y `citation`** se generan de forma determinista desde el contenido (no del texto del modelo), para que la cita siempre exista y sea la del ítem.
- **Herramientas:** `buscar_gpc` (fragmento de GPC del ítem), `registrar_intento` (marca el último intento de la sesión como `used_tutor`), `siguiente_caso` (tema sugerido por Thompson). El intento en sí lo registra `POST /api/attempt`, no el agente, para no duplicar.
- Modelo por defecto `gemini-3.5-flash` (configurable con `GEMINI_MODEL`). `gemini-2.5-flash`, el default de ADK TS 2.5, ya no está disponible para claves nuevas de AI Studio (404 al probar con la clave del equipo el 20 nov 2026).
- **Sin clave de Gemini no se pudo probar una conversación real con ADK.** Se verificó que el módulo carga, que envía la petición a Gemini y que, con clave inválida, cae al respaldo en ~200 ms.

## Auth

- "Entrar como Ana (demo)" es una server action que lee `DEMO_USER_EMAIL`/`DEMO_USER_PASSWORD` del servidor. Solo se muestra con `NEXT_PUBLIC_DEMO_MODE=true` y la acción también lo verifica.
- `proxy.ts` refresca la sesión con `getClaims()` y redirige a `/login` en rutas de `(app)`; el layout de `(app)` vuelve a verificar con `getUser()` (defensa en profundidad). Las APIs responden 401 sin sesión.
- Google detrás de `NEXT_PUBLIC_ENABLE_GOOGLE` (requiere configurar el proveedor en Supabase).

## UI

- Botones de 44–56 px; navegación inferior de 56 px + safe area; franja fija de aviso arriba.
- Se fuerza `color-scheme: light` (la demo no tiene modo oscuro).
- Contenido de ejemplo marcado en la UI (`SampleContentBadge`) y en el JSON (`notice`, `isSample`, prefijo "[Fragmento de ejemplo]" y GPC con id `EJEMPLO-GPC-*`).
- Las respuestas precargadas del examen (`demoAnswers`) aciertan los reactivos de Bronquiolitis para que en Progreso el tema débil **mejore** (+pts) en vivo.

## Entorno local

- Los puertos de Supabase local se movieron a **553xx** (otro proyecto en la máquina usa 543xx) y la app corre en **3100** (el 3000 estaba ocupado).

## Fuera de alcance (no está en el guion)

- Langfuse (P2 opcional): no se implementó.
- Recuperación de contraseña, edición de perfil, modo oscuro, service worker/offline.

## Identidad visual y ruta (iteración 2)

- **Paleta** azul profundo + turquesa (`brand-*` y `aqua-*` en `app/globals.css`); primario `#0b7d9a` (contraste AA con texto blanco).
- **Logo** original (`components/app/logo.tsx`): línea de pulso que termina en palomita ("razonar → acertar"). Los íconos PNG de PWA/iOS se generan desde `public/icons/icon.svg`.
- **Inicio como camino de objetivos**: una unidad por especialidad (con su % de aciertos = avance por especialidad) y un nodo por tema, en zigzag, con un nodo final de simulacro. Estados: dominado (≥3 respuestas y dominio ≥70 %), tema débil ("¡Empieza aquí!"), en progreso, nuevo. Los temas sin caso de práctica llevan al simulacro. La lógica es pura y está probada en `lib/learning/path.ts`.
- **Meta diaria** fija de 5 respuestas (`DAILY_GOAL`), sin persistir.
- "Salir" se movió a Progreso.

## Diagnóstico con el agente de Python (iteración 3)

- La app web habla con el servidor FastAPI de `agent/` desde route handlers (`/api/diagnostico/*`), nunca desde el navegador: el token (`AGENT_API_TOKEN`) y la URL (`AGENT_API_URL`) son solo de servidor, y el `user_id` sale de la sesión de Supabase.
- Las respuestas del agente se validan con Zod (`lib/schemas/diagnostic.ts`); el reactivo actual llega sin respuesta correcta.
- Flujo híbrido: crear, responder y calificar son deterministas; el agente narra. Sin clave de Gemini se muestra "Sin narración del agente" y todo lo demás funciona.
- El diagnóstico queda en `exams`/`exam_answers` (`exam_key = 'diagnostico-adk'`), así que actualiza el progreso y el tema débil de la app.
- El agente de Python no se despliega en Vercel en este demo; para producción habría que hospedarlo aparte (Cloud Run, por ejemplo) y definir `AGENT_API_URL`.
