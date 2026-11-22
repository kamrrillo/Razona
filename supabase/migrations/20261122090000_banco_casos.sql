-- Razona · fase 1 del banco de casos (json/casos → Supabase)
--
-- Solo AGREGA objetos; no modifica nada existente.
--   temas_grupos, temas   catálogo de temas (json/temas.json)
--   casos_clinicos        un caso del banco por fila; `payload` es el JSON tal cual
--                         y las demás columnas se CALCULAN de él (columnas generadas),
--                         así que no hay datos duplicados que puedan divergir.
--   v_casos_rubrica       una fila por entrada de la rúbrica
--   v_casos_citas         una fila por cita a la GPC (puntos clave + rúbrica)
--   v_casos_app           cada caso en el formato `Item` que consumen la app y el agente
--   exams.scope/...       el examen simulado guarda su alcance y sus reactivos
--
-- Seguridad: RLS activo y SIN políticas para anon/authenticated. La rúbrica revela la
-- respuesta por descarte, así que solo el servidor (service role) lee el banco.
-- Las vistas usan security_invoker para respetar ese RLS.
-- La carga la hace json/herramientas/cargar_supabase.py (upsert; nunca borra: retira).

-- ---------------------------------------------------------------------------
-- Catálogo de temas
-- ---------------------------------------------------------------------------
create table public.temas_grupos (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  nombre text not null,
  especialidad_id text not null references public.specialties (id),
  orden int not null default 0
);

create table public.temas (
  sindrome text primary key check (sindrome ~ '^[a-z0-9_]+$'),
  nombre text not null,
  grupo_id text not null references public.temas_grupos (id)
);

create index temas_grupo_idx on public.temas (grupo_id);

-- ---------------------------------------------------------------------------
-- Casos del banco
-- ---------------------------------------------------------------------------
create table public.casos_clinicos (
  id text primary key,
  payload jsonb not null,
  -- Columnas calculadas desde el payload (no se escriben; no pueden divergir).
  version text generated always as (payload ->> 'version') stored,
  sindrome text generated always as (payload ->> 'sindrome') stored
    references public.temas (sindrome),
  tipo text generated always as (payload ->> 'tipo') stored,
  caso_indice_id text generated always as (payload ->> 'caso_indice_id') stored
    references public.casos_clinicos (id),
  gpc_clave text generated always as (payload -> 'gpc_base' ->> 'clave') stored,
  respuesta_correcta text generated always as (payload ->> 'respuesta_correcta') stored,
  estado text generated always as (payload ->> 'estado') stored,
  updated_at timestamptz not null default now(),
  constraint casos_id_coincide check (id = payload ->> 'id'),
  constraint casos_id_formato check (id ~ '^RZ-[A-Z]{3}-[0-9]{3}-(I|V[0-9]+)$'),
  constraint casos_tipo check (tipo in ('indice', 'variante')),
  constraint casos_estado check (estado in ('borrador', 'en_revision', 'revisado_medico', 'retirado')),
  constraint casos_respuesta check (respuesta_correcta in ('A', 'B', 'C', 'D', 'E')),
  constraint casos_variante_tiene_indice check (
    (tipo = 'indice' and caso_indice_id is null)
    or (tipo = 'variante' and caso_indice_id is not null)
  )
);

create index casos_sindrome_idx on public.casos_clinicos (sindrome);
create index casos_indice_idx on public.casos_clinicos (caso_indice_id);
create index casos_estado_idx on public.casos_clinicos (estado);

-- updated_at solo cambia cuando cambia el contenido (la carga es idempotente).
create function public.casos_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payload is distinct from old.payload then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create trigger casos_touch_updated_at
  before update on public.casos_clinicos
  for each row execute function public.casos_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Vistas (security_invoker: respetan el RLS de casos_clinicos)
-- ---------------------------------------------------------------------------
create view public.v_casos_rubrica
with (security_invoker = true) as
select
  c.id as caso_id,
  r.orden::int as orden,
  r.e ->> 'tipo_error' as tipo_error,
  r.e ->> 'descripcion' as descripcion,
  array(select jsonb_array_elements_text(r.e -> 'opciones_asociadas')) as opciones_asociadas,
  array(select jsonb_array_elements_text(r.e -> 'senales_en_justificacion')) as senales_en_justificacion,
  r.e ->> 'pregunta_socratica_semilla' as pregunta_socratica_semilla,
  r.e ->> 'explicacion' as explicacion,
  r.e -> 'cita_gpc' ->> 'clave' as gpc_clave,
  r.e -> 'cita_gpc' ->> 'seccion' as seccion,
  (r.e -> 'cita_gpc' ->> 'pagina')::int as pagina,
  r.e -> 'cita_gpc' ->> 'fragmento' as fragmento
from public.casos_clinicos c
cross join lateral jsonb_array_elements(c.payload -> 'rubrica') with ordinality as r (e, orden);

create view public.v_casos_citas
with (security_invoker = true) as
select
  c.id as caso_id,
  'punto_clave'::text as origen,
  p.orden::int as orden,
  p.e ->> 'texto' as texto,
  p.e -> 'cita_gpc' ->> 'guia' as guia,
  p.e -> 'cita_gpc' ->> 'clave' as gpc_clave,
  p.e -> 'cita_gpc' ->> 'seccion' as seccion,
  (p.e -> 'cita_gpc' ->> 'pagina')::int as pagina,
  p.e -> 'cita_gpc' ->> 'fragmento' as fragmento
from public.casos_clinicos c
cross join lateral jsonb_array_elements(c.payload -> 'puntos_clave') with ordinality as p (e, orden)
union all
select
  c.id,
  'rubrica',
  r.orden::int,
  r.e ->> 'explicacion',
  r.e -> 'cita_gpc' ->> 'guia',
  r.e -> 'cita_gpc' ->> 'clave',
  r.e -> 'cita_gpc' ->> 'seccion',
  (r.e -> 'cita_gpc' ->> 'pagina')::int,
  r.e -> 'cita_gpc' ->> 'fragmento'
from public.casos_clinicos c
cross join lateral jsonb_array_elements(c.payload -> 'rubrica') with ordinality as r (e, orden);

-- Cita en el formato de la app (Citation de lib/schemas/content.ts).
create function public.cita_app(cita jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'gpcId', cita ->> 'clave',
    'gpcTitle', cita ->> 'guia',
    'section', cita ->> 'seccion',
    'page', (cita ->> 'pagina')::int,
    'snippet', cita ->> 'fragmento'
  )
$$;

-- Cada caso en el formato `Item` (lib/schemas/content.ts y agent/razona_agent/models.py).
-- Única traducción banco → app: la app web y el agente de Python leen de aquí.
create view public.v_casos_app
with (security_invoker = true) as
select
  c.id,
  c.sindrome,
  t.grupo_id,
  g.especialidad_id as specialty_id,
  t.nombre as topic,
  c.tipo,
  c.caso_indice_id,
  c.estado,
  jsonb_build_object(
    'id', c.id,
    'kind', 'case',
    'specialtyId', g.especialidad_id,
    'specialtyName', s.name,
    'topic', t.nombre,
    'title', case when c.tipo = 'indice' then t.nombre else t.nombre || ' · variante' end,
    'vignette', c.payload ->> 'vineta',
    'question', c.payload ->> 'pregunta',
    'options', (
      select jsonb_agg(jsonb_build_object('id', lower(o.key), 'text', o.value) order by o.key)
      from jsonb_each_text(c.payload -> 'opciones') as o
    ),
    'correctOptionId', lower(c.payload ->> 'respuesta_correcta'),
    'explanation', (
      select string_agg(p.e ->> 'texto', ' ' order by p.orden)
      from jsonb_array_elements(c.payload -> 'puntos_clave') with ordinality as p (e, orden)
    ),
    'citation', public.cita_app(c.payload -> 'puntos_clave' -> 0 -> 'cita_gpc'),
    'isSample', false,
    'tipo', c.tipo,
    'casoIndiceId', c.caso_indice_id,
    'sindrome', c.sindrome,
    'groupId', t.grupo_id,
    'groupName', g.nombre,
    'keyPoints', (
      select jsonb_agg(
        jsonb_build_object('text', p.e ->> 'texto', 'citation', public.cita_app(p.e -> 'cita_gpc'))
        order by p.orden
      )
      from jsonb_array_elements(c.payload -> 'puntos_clave') with ordinality as p (e, orden)
    ),
    'rubric', (
      select jsonb_agg(
        jsonb_build_object(
          'errorType', r.e ->> 'tipo_error',
          'description', r.e ->> 'descripcion',
          'optionIds', (
            select jsonb_agg(lower(x))
            from jsonb_array_elements_text(r.e -> 'opciones_asociadas') as x
          ),
          'question', r.e ->> 'pregunta_socratica_semilla',
          'explanation', r.e ->> 'explicacion',
          'citation', public.cita_app(r.e -> 'cita_gpc')
        )
        order by r.orden
      )
      from jsonb_array_elements(c.payload -> 'rubrica') with ordinality as r (e, orden)
    )
  ) as payload
from public.casos_clinicos c
join public.temas t on t.sindrome = c.sindrome
join public.temas_grupos g on g.id = t.grupo_id
join public.specialties s on s.id = g.especialidad_id
where c.estado <> 'retirado';

-- ---------------------------------------------------------------------------
-- RLS y permisos: solo el servidor (service role)
-- ---------------------------------------------------------------------------
alter table public.temas_grupos enable row level security;
alter table public.temas enable row level security;
alter table public.casos_clinicos enable row level security;

revoke all on public.temas_grupos, public.temas, public.casos_clinicos from anon, authenticated;
revoke all on public.v_casos_rubrica, public.v_casos_citas, public.v_casos_app from anon, authenticated;
revoke all on function public.cita_app(jsonb) from anon, authenticated;
revoke all on function public.casos_touch_updated_at() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Examen simulado por alcance (global, grupo o tema)
-- ---------------------------------------------------------------------------
alter table public.exams
  add column scope text not null default 'global'
    check (scope in ('global', 'grupo', 'tema', 'diagnostico')),
  add column scope_ref text,
  add column item_ids text[];
