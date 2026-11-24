-- Entrada del estudio (/estudio): la participante escribe su nombre (sesión anónima de
-- Supabase, sin correo ni contraseña) y después elige el modo: con IA o sin IA (control).
-- Sus respuestas quedan en las tablas de siempre (attempts, exams, exam_answers) ligadas a
-- su profiles.id; el nombre queda en profiles.display_name.
--
-- profiles.study_group_chosen_at: cuándo quedó fijo el grupo. La elección se hace una sola
-- vez con elegir_grupo_estudio(); la usuaria no puede cambiar study_group directamente.

alter table public.profiles add column study_group_chosen_at timestamptz;

-- Las cuentas creadas con el enlace ?grupo=control ya traen el grupo: queda fijo al crearse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, study_group, study_group_chosen_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), ''),
    case when new.raw_user_meta_data ->> 'study_group' = 'control' then 'control' else 'ia' end,
    case when new.raw_user_meta_data ? 'study_group' then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Fija el modo de la usuaria actual. Solo funciona la primera vez; después devuelve el que ya
-- tenía. security definer porque authenticated no puede actualizar study_group.
create function public.elegir_grupo_estudio(grupo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual text;
begin
  if grupo not in ('ia', 'control') then
    raise exception 'grupo no válido: %', grupo using errcode = '22023';
  end if;
  update public.profiles
     set study_group = grupo, study_group_chosen_at = now()
   where id = (select auth.uid()) and study_group_chosen_at is null;
  select study_group into actual from public.profiles where id = (select auth.uid());
  return actual;
end;
$$;

revoke all on function public.elegir_grupo_estudio(text) from public, anon;
grant execute on function public.elegir_grupo_estudio(text) to authenticated;
