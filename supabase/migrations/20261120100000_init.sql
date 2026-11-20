-- Razona · esquema inicial del demo
-- Tablas: profiles, specialties, items, study_sessions, attempts, exams, exam_answers
-- RLS: cada usuario solo ve lo suyo; specialties/items solo para usuarios autenticados.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- specialties
-- ---------------------------------------------------------------------------
create table public.specialties (
  id text primary key,
  name text not null,
  sort_order int not null default 0
);

alter table public.specialties enable row level security;

create policy "specialties_select_authenticated" on public.specialties
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- items (espejo del contenido de content/*.json; lo sincroniza scripts/seed-demo.ts)
-- ---------------------------------------------------------------------------
create table public.items (
  id text primary key,
  kind text not null check (kind in ('case', 'exam')),
  specialty_id text not null references public.specialties (id),
  topic text not null,
  payload jsonb not null,
  is_sample boolean not null default true,
  updated_at timestamptz not null default now()
);

create index items_specialty_idx on public.items (specialty_id);
create index items_topic_idx on public.items (topic);

alter table public.items enable row level security;

create policy "items_select_authenticated" on public.items
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- study_sessions (una sesión de práctica por caso; guarda el historial del tutor)
-- ---------------------------------------------------------------------------
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  item_id text not null references public.items (id),
  messages jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index study_sessions_user_idx on public.study_sessions (user_id, started_at desc);

alter table public.study_sessions enable row level security;

create policy "study_sessions_select_own" on public.study_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "study_sessions_insert_own" on public.study_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "study_sessions_update_own" on public.study_sessions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- attempts (cada respuesta en modo práctica)
-- ---------------------------------------------------------------------------
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  session_id uuid references public.study_sessions (id) on delete cascade,
  item_id text not null references public.items (id),
  specialty_id text not null references public.specialties (id),
  topic text not null,
  selected_option text not null,
  is_correct boolean not null,
  used_tutor boolean not null default false,
  created_at timestamptz not null default now()
);

create index attempts_user_idx on public.attempts (user_id, created_at desc);

alter table public.attempts enable row level security;

create policy "attempts_select_own" on public.attempts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "attempts_insert_own" on public.attempts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "attempts_update_own" on public.attempts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- exams y exam_answers
-- ---------------------------------------------------------------------------
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  exam_key text not null,
  duration_seconds int not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total int,
  correct int,
  score numeric(5, 2)
);

create index exams_user_idx on public.exams (user_id, started_at desc);

alter table public.exams enable row level security;

create policy "exams_select_own" on public.exams
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "exams_insert_own" on public.exams
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "exams_update_own" on public.exams
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.exam_answers (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  item_id text not null references public.items (id),
  specialty_id text not null references public.specialties (id),
  topic text not null,
  selected_option text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (exam_id, item_id)
);

create index exam_answers_user_idx on public.exam_answers (user_id, answered_at desc);

alter table public.exam_answers enable row level security;

create policy "exam_answers_select_own" on public.exam_answers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "exam_answers_insert_own" on public.exam_answers
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.exams e
      where e.id = exam_id and e.user_id = (select auth.uid()) and e.finished_at is null
    )
  );
create policy "exam_answers_update_own" on public.exam_answers
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.exams e
      where e.id = exam_id and e.user_id = (select auth.uid()) and e.finished_at is null
    )
  );
