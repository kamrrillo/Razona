# Razona · agente en Python (Google ADK)

Sistema multiagente con **Google ADK para Python** que (1) aplica **exámenes diagnósticos** y (2) **prepara a la estudiante** (progreso, tema débil, siguiente caso, plan de estudio, tutor socrático). Todo se lee y se escribe en la base de Supabase del proyecto.

> Demo educativo, no sustituye el criterio clínico. Todo el contenido es **CONTENIDO DE EJEMPLO — reemplazar por los ítems validados**. Los agentes solo usan la explicación y la cita de la GPC que vienen en `items.payload`; no inventan datos clínicos.

## Inicio rápido

Requisitos: [uv](https://docs.astral.sh/uv/) (o Python ≥ 3.11 + pip), Supabase local corriendo (`supabase start`) y Ana sembrada (`pnpm seed:demo`).

```bash
cd agent
uv sync                                  # crea agent/.venv e instala dependencias
cp .env.example .env                     # opcional: lo que falte se toma de ../.env.local
export GOOGLE_API_KEY=tu-clave           # o ponla en agent/.env (alias: GOOGLE_GENAI_API_KEY)
```

| Qué | Comando (desde `agent/`) |
|---|---|
| UI de desarrollo de ADK | `uv run adk web` → http://127.0.0.1:8000, elige **razona_agent** |
| API de ADK (sin UI) | `uv run adk api_server` |
| Chat en la terminal | `uv run python -m razona_agent.cli` (Ana) o `--email correo@x.com` / `--user-id <uuid>` |
| Servidor FastAPI propio | `uv run python -m razona_agent.server --port 8080` |
| Pruebas (sin clave) | `uv run pytest` |

Sin clave, la CLI y el servidor terminan con un mensaje en español que indica exactamente qué variable definir; en `adk web` los agentes responden ese mismo mensaje en el chat en lugar de llamar a Gemini.

Sin uv: `python3 -m venv .venv && .venv/bin/pip install -e . pytest` y usa `.venv/bin/adk web`, `.venv/bin/python -m razona_agent.cli`, `.venv/bin/pytest`.

### Servidor FastAPI

```bash
TOKEN=...   # AGENT_API_TOKEN (en local se toma de ../.env.local)
curl -s -X POST localhost:8080/sesiones -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{}'
# → {"session_id": "...", "user_id": "<uuid de Ana>", "nombre": "Ana"}
curl -s -X POST localhost:8080/sesiones/<session_id>/mensajes -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"user_id": "<uuid>", "texto": "Quiero hacer un diagnóstico"}'
```

También `GET /salud` (sin token). Si `AGENT_API_TOKEN` está definido, todos los demás endpoints exigen `Authorization: Bearer <token>`. El servidor arranca aunque falte la clave de Gemini (avisa en la terminal): el diagnóstico web funciona sin narración y los endpoints de chat devuelven 503.

### Conexión con la app web (diagnóstico)

La app de Next.js usa el **agente de diagnóstico** en `/diagnostico` (acceso desde la pestaña Examen). Sus rutas `POST /api/diagnostico/{start,answer,message,grade}` verifican la sesión de Supabase, ponen el `user_id` desde el servidor y llaman a estos endpoints con el token (`lib/agent/client.ts`):

| Endpoint | Qué hace |
|---|---|
| `POST /diagnostico/sesiones` `{user_id, n_por_especialidad?}` | Crea el examen (determinista) y la sesión ADK; el agente saluda. |
| `POST /diagnostico/sesiones/{id}/respuestas` `{user_id, item_id, opcion}` | Registra la respuesta (determinista, sin LLM). |
| `POST /diagnostico/sesiones/{id}/mensajes` `{user_id, texto}` | Turno del agente (sin pistas mientras no se califica). |
| `POST /diagnostico/sesiones/{id}/calificar` `{user_id}` | Califica (determinista) y el agente explica los resultados. |

Todos devuelven `{session_id, agente_disponible, estado, respuestas}`; `estado` trae el progreso, el reactivo actual **sin respuesta** y, al calificar, el resultado con explicaciones y citas. Una sesión solo responde a la `user_id` que la creó (404 para cualquier otra). Para usarlo en local:

```bash
cd agent && uv run python -m razona_agent.server --port 8080   # en otra terminal: pnpm dev --port 3100
```

La app necesita `AGENT_API_URL` y `AGENT_API_TOKEN` en `.env.local` (ver `.env.example` del repo).

## Agentes

```
coordinador (root_agent)
├── agente_diagnostico   listar_especialidades, crear_examen_diagnostico, registrar_respuesta, calificar_diagnostico
├── agente_preparacion   obtener_progreso, obtener_tema_debil, recomendar_siguiente_caso, generar_plan_estudio
└── tutor_socratico      obtener_caso, buscar_gpc, registrar_intento, recomendar_siguiente_caso
```

- **Coordinador**: saluda por nombre (`{razona_nombre?}` desde el estado) y deriva con `transfer_to_agent`.
- **Diagnóstico**: arma un examen balanceado por especialidad desde la tabla `items` (crea una fila en `exams` con `exam_key='diagnostico-adk'`), presenta un reactivo a la vez **sin respuestas ni pistas**, guarda cada respuesta en `exam_answers` (upsert) y al calificar cierra el examen (`finished_at`, `total`, `correct`, `score`) y devuelve desglose por especialidad/tema, temas débiles y la revisión con explicación + cita de la GPC.
- **Preparación**: lee `attempts` + `exam_answers` de exámenes terminados; dominio por tema = media posterior Beta (aciertos+1)/(total+2); tema débil = menor dominio con ≥ 3 respuestas; siguiente caso por **Thompson sampling** sobre Beta(1+errores, 1+aciertos) con la misma semilla y PRNG que la app de Next.js (`hashString(userId:nRespuestas)` + mulberry32); racha en `America/Mexico_City`. El **plan de estudio es determinista** (lo calcula `learning.build_study_plan`) y el LLM solo lo narra.
- **Tutor socrático**: mismas reglas que `lib/ai/adk-engine.ts`: nunca da la respuesta, una pregunta socrática, siempre cita la GPC (`buscar_gpc`), `registrar_intento` escribe en `attempts` (`used_tutor=true`); si acierta, devuelve explicación y cita.

### Salvaguardas

- `after_model_callback` (`answer_guardrail`) en todos los agentes: si una respuesta revela la opción correcta de un reactivo protegido (los del diagnóstico sin calificar y el caso activo hasta que la estudiante acierte), se reemplaza por un mensaje seguro con la cita de la GPC. Es un port de `revealsAnswer` (`lib/ai/tutor-engine.ts`) que además permite presentar el reactivo con todas sus opciones.
- `before_model_callback` (`require_credentials`): sin clave, responde con el mensaje en español en vez de fallar con un error críptico.
- `registrar_intento` se niega mientras haya un diagnóstico abierto (tutor apagado).

## Estado de sesión y usuaria

Las herramientas **nunca** reciben el id de la estudiante del LLM: lo leen de `tool_context.state["razona_user_id"]`.

- **CLI / servidor**: `razona_agent.session.create_student_session(session_service, email=..., user_id=...)` resuelve a la estudiante (por defecto `DEMO_USER_EMAIL`, Ana) y crea la sesión ADK con `state={"razona_user_id", "razona_nombre", "razona_email"}`; el `user_id` de ADK es el uuid de la estudiante.
- **`adk web` / `adk api_server`**: ADK crea sesiones sin ese estado, así que el `before_agent_callback` del coordinador (`ensure_student_in_state`) lo llena: si el user id de ADK es un uuid o un correo, lo busca; si no (la UI usa `user`) y `RAZONA_DEMO_FALLBACK` está activo (por defecto), usa a Ana. También puedes crear la sesión por la API de ADK con estado inicial `{"razona_user_id": "<uuid>"}`.
- Otras claves: `razona_diagnostico` (exam_id, item_ids, finalizado), `razona_examen_activo`, `razona_caso_activo`, `razona_casos_resueltos`.

## Estructura

```
agent/
  pyproject.toml, uv.lock, .env.example, .gitignore
  razona_agent/
    __init__.py      exporta root_agent (lo carga `adk web`)
    agent.py         árbol de agentes (build_root_agent)
    prompts.py       instrucciones en español
    callbacks.py     guardrail, credenciales, resolución de la estudiante
    config.py        carga de variables (agent/.env → ../.env.local)
    db.py            repositorio supabase-py, consultas con user_id explícito
    models.py        Pydantic: Item (espejo del Zod), stats, DiagnosticResult, StudyPlan...
    learning.py      dominio, tema débil, Thompson, racha, plan (puro, con pruebas)
    services.py      lógica de dominio que usan las herramientas
    state.py         claves del estado de sesión
    session.py       resolver estudiante y crear sesión
    tools/           herramientas por agente
    runtime.py, cli.py, server.py
  tests/             pytest (sin clave; integración contra Supabase local)
```

## Pruebas

`uv run pytest` (≈ 40 pruebas, sin clave de Gemini):

- `test_learning.py`: dominio, tema débil, racha y plan; **paridad exacta** del PRNG, `hashString`, Beta y Thompson con valores calculados con el código TypeScript.
- `test_models_db.py`: parseo con Pydantic de todas las filas reales de `items.payload`.
- `test_tools_integration.py`: diagnóstico completo (crear → responder → calificar), progreso, tema débil, Thompson, plan y tutor contra Supabase local como Ana. Cada prueba borra lo que crea y verifica que el historial de Ana quede igual.
- `test_runner_mock.py`: `Runner` de ADK con un modelo falso con guion: coordinador → tutor, herramientas con el usuario del estado y guardrail bloqueando una respuesta que revela la opción correcta.
- `test_agent_tree.py`, `test_config.py`, `test_guardrail.py`, `test_server.py`.

Las pruebas de integración se omiten (no fallan) si Supabase local no responde.

## Decisiones

- **Versiones verificadas leyendo el paquete instalado**: `google-adk` 2.15.0 (`LlmAgent`/`Agent`, `ToolContext = Context`, funciones simples como herramientas con detección del parámetro de contexto, `sub_agents` + `transfer_to_agent`, `Runner(app_name=..., agent=..., session_service=...)`, `InMemorySessionService.create_session(app_name, user_id, state)`, callbacks `before_agent`/`before_model`/`after_model`, plantillas `{clave?}` en instrucciones, `adk web` busca `root_agent` en `<carpeta>/__init__.py` o `agent.py`), `google-genai` 2.34.0, `supabase` 2.34.1, `pydantic` 2.14, `fastapi` 0.165, `pytest` 9.2, Python 3.12, `uv` 0.12.
- **Modelo por defecto `gemini-3.5-flash`**: es `LlmAgent.DEFAULT_MODEL` en google-adk 2.15 (la app de Next.js usa `gemini-2.5-flash`, el default de su ADK de TS). Configurable con `GEMINI_MODEL`; no se toma de `.env.local` para no mezclar versiones.
- **supabase-py en lugar de psycopg**: funciona igual en local y en Supabase hospedado solo con URL + llave secreta (sin contraseña de Postgres ni red directa al puerto 5432) y usa las mismas consultas PostgREST que `lib/data/*.ts`. Como la llave de servicio salta RLS, **cada consulta de datos de usuaria filtra por `user_id`** explícitamente. `DATABASE_URL` queda documentada como opcional y el agente no la usa.
- **Sesiones ADK en memoria** (`InMemorySessionService`): la fuente de verdad es Supabase; perder el historial del chat al reiniciar no pierde datos. `adk web` usa su propio almacenamiento local en `agent/.adk/` (ignorado en git).
- **Selección del diagnóstico**: por especialidad (orden de `specialties.sort_order`), primero reactivos `exam`, luego `case`; primero un tema distinto por reactivo y después se rellena; orden por id (determinista). Por defecto 2 por especialidad (8 reactivos), máximo 5. Duración = 90 s por reactivo.
- **Lista de reactivos del diagnóstico en el estado de sesión**: la tabla `exams` no guarda qué reactivos incluye, así que `razona_diagnostico.item_ids` vive en la sesión. Calificar cuenta los no respondidos como incorrectos en la calificación (igual que `gradeExam` en TS), pero el desglose por tema/especialidad usa solo los respondidos (los no respondidos no tienen fila en `exam_answers`). Si se crea un diagnóstico nuevo, el anterior sin calificar queda abierto y no cuenta en el progreso.
- **Sin retroalimentación durante el diagnóstico**: `registrar_respuesta` no devuelve si fue correcta; la revisión (explicación + cita) solo sale de `calificar_diagnostico`.
- **Intentos del tutor**: `registrar_intento` inserta en `attempts` con `used_tutor=true` y `session_id=null` (como el historial sintético de Ana); no se crean `study_sessions` porque la conversación ya vive en la sesión ADK. Se registra cada opción elegida (correcta o no).
- **Plan de estudio**: prioridad = tema débil → temas en progreso (por dominio) → temas nuevos → temas dominados (≥ 3 respuestas y dominio ≥ 70 %, como `lib/learning/path.ts`); un tema por día en ciclo; con ≥ 3 días el último es un simulacro diagnóstico. Rango 1–30 días.
- **Guardrail por texto, sin streaming**: la CLI y el servidor no usan streaming; en `adk web` con streaming SSE el callback ve fragmentos parciales y podría no detectar una revelación partida en dos fragmentos.
- **`adk web` actúa como Ana** por defecto (`RAZONA_DEMO_FALLBACK=TRUE`) porque su UI usa el user id `user`. Desactívalo fuera de la demo local.
- **Servidor propio delgado** en lugar de `get_fast_api_app`: así la sesión se crea siempre con la estudiante resuelta en el servidor. Para la API/UI completas de ADK están `adk api_server` / `adk web`.
- **Diagnóstico web híbrido:** crear el examen, registrar respuestas y calificar son llamadas deterministas (no dependen de que el LLM elija la herramienta correcta); el agente (`build_web_diagnostic_agent`, con una instrucción extra para la UI) saluda, responde dudas sin dar pistas y explica los resultados. Sin clave de Gemini el flujo funciona igual, sin narración.
- **Token compartido** (`AGENT_API_TOKEN`) entre la app y el servidor; la app lo envía solo desde el servidor. El `user_id` nunca viene del navegador: lo pone la ruta de Next.js a partir de la sesión de Supabase.
- **Calificar antes de terminar** está permitido; los reactivos sin responder cuentan como incorrectos.
