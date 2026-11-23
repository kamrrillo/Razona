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
- ~~**El contenido vive en JSON, no en la base.**~~ Reemplazado en la iteración 6 (banco de casos en Supabase). Texto original: `content/items.json`, `content/exam.json` y `content/tutor-fallback.json` se validan con Zod al cargar el módulo (si el equipo los rompe, fallan `pnpm test` y el build). La tabla `items` es un espejo que sincroniza `pnpm seed:demo`, para integridad referencial y para cumplir "los ítems los leen solo usuarios autenticados". El cliente nunca recibe la respuesta correcta ni la explicación hasta que acierta (`PublicItemSchema`).
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

## Gemini en vivo (20 nov 2026, con la clave del equipo)

- `gemini-2.5-flash` devuelve 404 para claves nuevas → por defecto `gemini-3.5-flash` en la app y en el agente.
- Latencia medida con un prompt del tamaño del tutor: `gemini-3.5-flash` ~4.3 s con razonamiento por defecto y ~1.5 s con `thinking_level=MINIMAL`; los modelos *lite* < 1 s. Un turno del tutor ADK hace 2 llamadas (buscar_gpc + respuesta), así que se usa **MINIMAL** (`GEMINI_THINKING_LEVEL`) para quedar bajo el límite de 6 s: turnos medidos de 2.7–4.2 s en el tutor y 1–3.5 s en el diagnóstico.
- El modelo a veces responde con Markdown; se pide texto plano y además se limpia (`lib/text.ts`).
- Las pruebas de Python fuerzan la clave vacía para no llamar a Gemini aunque exista en `.env.local`.
- Si la cuenta se queda sin créditos (402) o el modelo está saturado (503), el tutor cae al respaldo y el diagnóstico sigue sin narración.

## Explicación personalizada y diagramas conceptuales (iteración 6, reemplaza a la 4)

- **Después de responder, el tutor explica con el contexto real de la estudiante**: su nombre, qué opción(es) eligió y en qué orden, lo que le escribió al tutor, su historial en el tema (aciertos/total, si es su tema más débil) y su racha. Todo sale de Supabase (`lib/data/learner.ts`); el modelo no inventa datos de la estudiante.
- **Siempre explica el porqué**: `why` (por qué la correcta), `fundamentals` (2–4 conceptos base), `distractors` (por qué no aplica cada opción incorrecta, primero las que eligió) y `nextStep` según su historial.
- **Diagramas conceptuales, no recorridos**: el modelo elige el tipo que mejor explica el tema: `escala` (puntos de corte con el valor del paciente), `arbol` (clasificaciones/decisiones, con el criterio en cada arista), `flujo` (mecanismos/cadenas causales) o `comparacion` (tabla correcta vs elegida). El modelo devuelve datos (outputSchema de ADK, plano para Gemini); la app los valida, recorta para el teléfono (árbol ≤ 3 niveles, ≤ 5 hojas) y los dibuja con su propio SVG (`lib/diagram-layout.ts`, `components/app/concept-diagram.tsx`). Los nodos con nota son botones HTML superpuestos (accesibles con teclado).
- **Límite de contenido**: cifras, puntos de corte, dosis y recomendaciones solo del reactivo y la GPC citada; los fundamentos pueden usar fisiología/fisiopatología básica. Se prohíbe citar otras fuentes (el modelo llegó a mencionar «la ADA»). La UI marca la explicación como generada con IA. Riesgo conocido: en clasificaciones (p. ej. hipertensión en el embarazo) el modelo puede usar criterios generales que no están en el fragmento de ejemplo; con los ítems validados conviene ampliar los fragmentos de GPC.
- **Respaldo sin LLM** (`buildFallbackExplanation`): mismo contrato, personalizado con los datos reales y con un mapa conceptual en árbol construido solo con campos del ítem. Se usa sin clave, si falla o si tarda más de 14 s. Medido: 4–6 s con `gemini-3.5-flash` y razonamiento MINIMAL.
- El indicador de desarrollo de Next.js se desactivó: tapaba la navegación inferior en el teléfono.

## Despliegue (iteración 5, 20 nov 2026)

- **Dos proyectos de Vercel**: `razona` (Next.js) y `razona-agent` (FastAPI, raíz `agent/`, entrypoint `agent/index.py`). Se desplegaron con la CLI, sin integración de Git, porque el repo de GitHub está en otra cuenta; para redeploy: `vercel deploy --prod` en cada carpeta.
- **Sesiones del agente en Postgres.** En Vercel las peticiones del mismo diagnóstico pueden ir a instancias distintas, así que `InMemorySessionService` perdía la sesión. Con `ADK_SESSIONS_DB_URL` se usa `DatabaseSessionService` (SQLAlchemy + asyncpg, `NullPool`, sin caché de *prepared statements*) en un esquema **`adk` privado**: no lo expone la Data API y `anon`/`authenticated` no tienen permisos (migración `20261121090000`). En local sigue en memoria.
- **Supabase en la nube** `razona` (us-east-1, junto a `iad1` de Vercel). La configuración de Auth de producción se versiona en `[remotes.production]` de `config.toml`: solo cambia Site URL y redirect; la confirmación por email y MFA quedan con los valores por defecto de la nube.
- La contraseña de Ana en producción es distinta a la local y vive solo en las variables de Vercel y en `.env.vercel.local`.
- `NEXT_PUBLIC_ENABLE_GOOGLE=false` en producción (el proveedor de Google no está configurado en Supabase).

## Banco de casos en Supabase (iteración 6, 22 nov 2026)

- **Fuente única: `json/casos` (110 casos de pediatría) + `json/temas.json`.** Se eliminaron `content/*.json` (contenido de ejemplo) y la etiqueta "contenido de ejemplo".
- **Carga:** `json/herramientas/cargar_supabase.py` (`pnpm content:load`) valida con `validar_casos.py` (sin R3, que es regla del generador) y hace upsert de grupos → temas → índices → variantes. Nunca borra: un caso que sale del banco queda `retirado`.
- **`casos_clinicos.payload` guarda el caso tal cual**; `sindrome`, `tipo`, `caso_indice_id`, `estado`, etc. son **columnas generadas** del payload, así que no hay datos duplicados que puedan divergir.
- **Una sola traducción banco → app:** la vista `v_casos_app` produce el `Item` (opciones A–E → a–e, puntos clave → explicación, primera cita → `citation` con página, más `rubric` y `keyPoints`). La app web (`lib/content`) y el agente de Python leen de ahí.
- **Solo servidor:** RLS sin políticas y permisos revocados para `anon`/`authenticated` en tablas y vistas (la rúbrica revela la respuesta por descarte). Las vistas usan `security_invoker`. La app lee con la service role y nunca envía `rubric`/`keyPoints` al cliente (`PublicItemSchema`).
- **`attempts`, `exam_answers` y `study_sessions` apuntan a `casos_clinicos`** (llaves `NOT VALID`: el historial anterior con ítems de ejemplo no se toca). La tabla `items` queda sin uso; se elimina en la fase 3.
- **Práctica = casos índice**; las variantes se reservan para el examen y, después, para medir transferencia.
- **Examen simulado por alcance:** global (10, repartidos entre áreas), por área (hasta 10) o por tema (índice + variante). `exams` guarda `scope`, `scope_ref` e `item_ids`. Duración: 90 s por reactivo. "Completar examen (demo)" llena lo que falte con la respuesta correcta.
- **Áreas:** los 55 temas se agrupan en 9 áreas (`json/temas.json`, propuesta para revisar con el equipo clínico). Inicio y Progreso muestran el avance por área.
- **Tutor:** con un error, el tutor (ADK y respaldo) usa la entrada de la rúbrica de esa opción: tipo de error, pregunta socrática semilla y su cita con página. `rubricFor` nunca devuelve la opción correcta.
- **Resultados del examen:** cada reactivo fallado muestra "Por qué te desviaste" con el tipo de error y la explicación de la rúbrica.
- **Agente de Python:** lee `v_casos_app`; el diagnóstico reparte por área (1 por área por defecto) y `buscar_gpc(item_id, opcion)` devuelve la guía de la rúbrica para una opción incorrecta.
- **Lint:** Biome excluye `json/casos`, `json/fuentes` y `json/esquema` (datos que generan las herramientas de Python).

## Iteración: explicación al responder (acierto o error)

- **El caso de práctica se responde una sola vez.** Antes, con un error se abría el tutor socrático y la estudiante reintentaba hasta acertar; ahora, acierte o no, se revela la respuesta y el tutor explica en el mismo formato: lo que dice la GPC (citada con clave, sección y página, y enlace al PDF cuando la fuente lo traiga), por qué, diagrama y fundamentos, distractores, widget interactivo y una pregunta socrática con diálogo progresivo (recordar → transferir).
- **Error = corregir; acierto = reforzar.** El prompt de la explicación, el widget y el diálogo reciben el resultado: con error identifican la idea equivocada y la hacen reconstruir el razonamiento; con acierto consolidan el criterio usado y lo llevan a una variante.
- El tutor de chat previo a la respuesta (`/api/tutor`) queda en el código pero la práctica ya no lo usa; la conversación socrática ocurre después de la explicación (`/api/explain/socratic`).
- El widget se ejecuta en un iframe `sandbox="allow-scripts"` con CSP sin red; sus imágenes (banco → Wikimedia Commons con licencia libre → generada con Gemini) se descargan y verifican en el servidor y viajan como `data:`.
