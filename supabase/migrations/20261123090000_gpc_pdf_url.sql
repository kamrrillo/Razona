-- Enlace al PDF de la GPC en cada cita.
--
-- json/fuentes/NNN.json puede traer `url` (https) con el PDF público de la guía;
-- construir_casos.py lo copia a cada cita_gpc como `url_pdf`. Aquí se expone como
-- `pdfUrl` (Citation de lib/schemas/content.ts) para que la app enlace al PDF en la
-- página citada. jsonb_strip_nulls quita las claves nulas: las citas sin enlace (o sin
-- página) quedan igual que antes y siguen cumpliendo el esquema de la app.
create or replace function public.cita_app(cita jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'gpcId', cita ->> 'clave',
    'gpcTitle', cita ->> 'guia',
    'section', cita ->> 'seccion',
    'page', (cita ->> 'pagina')::int,
    'snippet', cita ->> 'fragmento',
    'pdfUrl', nullif(cita ->> 'url_pdf', '')
  ))
$$;

revoke all on function public.cita_app(jsonb) from anon, authenticated;
