-- Grupo del estudio (con IA o control sin IA) para comparar el método socrático.
--
-- profiles.study_group:
--   'ia'       versión completa: tutor socrático, explicación con IA, diagramas, recursos, diagnóstico.
--   'control'  solo el cuestionario: un intento por caso, después la respuesta correcta y la
--              explicación fija del caso con su cita. Sin tutor ni nada generado por IA.
--
-- Se fija al crear la cuenta (el enlace de registro con ?grupo=control manda
-- raw_user_meta_data.study_group) y la usuaria no puede cambiarlo: solo puede actualizar
-- display_name. El equipo lo cambia con la llave secreta si hiciera falta.

alter table public.profiles
  add column study_group text not null default 'ia'
    constraint profiles_study_group check (study_group in ('ia', 'control'));

revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, study_group)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), ''),
    case when new.raw_user_meta_data ->> 'study_group' = 'control' then 'control' else 'ia' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
