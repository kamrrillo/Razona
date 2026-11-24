-- Acuerdo de confidencialidad y uso de datos del estudio (/estudio).
--
-- La participante lo acepta antes de escribir su nombre; la app manda
-- raw_user_meta_data.study_consent = true al crear la sesión anónima y aquí se guarda la fecha.
-- Sin esa aceptación la app no crea la participante.

alter table public.profiles add column study_consent_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, study_group, study_group_chosen_at, study_consent_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), ''),
    case when new.raw_user_meta_data ->> 'study_group' = 'control' then 'control' else 'ia' end,
    case when new.raw_user_meta_data ? 'study_group' then now() end,
    case when new.raw_user_meta_data ->> 'study_consent' = 'true' then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
