-- Recursos de aprendizaje (json/casos: campo "recursos") en la vista que leen la app y el agente.
--
-- Cada recurso pasa al formato `Resource` de lib/schemas/content.ts:
--   flashcard → front, back      diagrama → diagram (code)   resaltado → highlight (fragment, reason)
--   tabla → table (columns, rows) imagen → image (imagePath, source, author, license, sourceUrl)
-- Las citas (cita o citas) quedan en `citations` con el formato de cita_app. Los recursos
-- retirados no se muestran. La imagen se sirve desde /recursos/<archivo> (json/assets).
-- Solo agrega una clave al payload de v_casos_app: las columnas de la vista no cambian.

create function public.recursos_app(recursos jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'id', r.e ->> 'id',
      'type', case r.e ->> 'tipo'
        when 'diagrama' then 'diagram'
        when 'resaltado' then 'highlight'
        when 'tabla' then 'table'
        when 'imagen' then 'image'
        else r.e ->> 'tipo'
      end,
      'concept', r.e ->> 'concepto',
      'errorTypes', r.e -> 'para_errores',
      'front', r.e ->> 'frente',
      'back', r.e ->> 'reverso',
      'code', r.e ->> 'codigo',
      'fragment', r.e ->> 'fragmento',
      'reason', r.e ->> 'motivo',
      'columns', r.e -> 'columnas',
      'rows', r.e -> 'filas',
      'imagePath', case when r.e ? 'archivo'
        then '/recursos/' || regexp_replace(r.e ->> 'archivo', '^.*/', '') end,
      'description', r.e ->> 'descripcion',
      'source', r.e ->> 'fuente',
      'author', r.e ->> 'autor',
      'license', r.e ->> 'licencia',
      'sourceUrl', r.e ->> 'url_pagina',
      'citations', (
        select jsonb_agg(public.cita_app(x.e) order by x.orden)
        from jsonb_array_elements(
          case when r.e ? 'cita' then jsonb_build_array(r.e -> 'cita') else coalesce(r.e -> 'citas', '[]') end
        ) with ordinality as x (e, orden)
        where x.e ? 'clave'
      )
    ))
    order by r.orden
  ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(recursos, '[]'::jsonb)) with ordinality as r (e, orden)
  where coalesce(r.e ->> 'estado', 'borrador') <> 'retirado'
$$;

revoke all on function public.recursos_app(jsonb) from anon, authenticated;

create or replace view public.v_casos_app
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
    ),
    'resources', public.recursos_app(c.payload -> 'recursos')
  ) as payload
from public.casos_clinicos c
join public.temas t on t.sindrome = c.sindrome
join public.temas_grupos g on g.id = t.grupo_id
join public.specialties s on s.id = g.especialidad_id
where c.estado <> 'retirado';

revoke all on public.v_casos_app from anon, authenticated;
