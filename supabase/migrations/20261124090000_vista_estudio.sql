-- Vista para analizar el estudio (/estudio): una fila por respuesta de cada participante.
--
-- Participante = perfil con study_consent_at (solo lo llena el flujo de /estudio al aceptar el
-- acuerdo). Así quedan fuera las cuentas normales, incluidas las del enlace ?grupo=control.
--
--   select * from v_estudio;                                  -- todo, para exportar a CSV
--   select modo, avg(es_correcta::int), avg(segundos)          -- comparar modos
--     from v_estudio group by modo;
--   select * from v_estudio where acepto_at >= '2026-11-26';  -- sin las pruebas previas
--
-- Para quitar una participante de prueba: borrar su cuenta en Authentication → Users; su perfil,
-- respuestas y casos se borran en cascada.
--
-- Solo para el equipo (SQL editor o llave secreta): sin acceso para anon ni authenticated.

create view public.v_estudio
with (security_invoker = true) as
select
  p.id as participante_id,
  p.display_name as nombre,
  case p.study_group when 'control' then 'sin IA' else 'con IA' end as modo,
  p.study_consent_at as acepto_at,
  p.study_group_chosen_at as eligio_modo_at,
  row_number() over (partition by p.id order by a.created_at)::int as pregunta,
  a.item_id as caso_id,
  t.nombre as tema,
  upper(a.selected_option) as opcion_elegida,
  c.respuesta_correcta as opcion_correcta,
  a.is_correct as es_correcta,
  s.started_at as mostrada_at,
  a.created_at as respondida_at,
  round(extract(epoch from (a.created_at - s.started_at))::numeric, 1) as segundos
from public.profiles p
join public.attempts a on a.user_id = p.id
left join public.study_sessions s on s.id = a.session_id
left join public.casos_clinicos c on c.id = a.item_id
left join public.temas t on t.sindrome = c.sindrome
where p.study_consent_at is not null;

revoke all on public.v_estudio from anon, authenticated;
