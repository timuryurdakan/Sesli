-- Stage 03 (Ajan 3 — Dosya Yükleme ve İş Kuyruğu Altyapısı)

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  storage_path text not null,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

alter table public.tracks enable row level security;

create policy "tracks_select_own"
  on public.tracks for select
  using (auth.uid() = user_id);

create policy "tracks_delete_own"
  on public.tracks for delete
  using (auth.uid() = user_id);

-- Insert/update yalnızca service-role (apps/api) üzerinden yapılır (RLS'i bypass eder),
-- bu yüzden authenticated rolü için ayrı bir insert/update politikası yok.

create type public.job_status as enum ('pending', 'processing', 'done', 'failed');

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  status public.job_status not null default 'pending',
  input jsonb not null,
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jobs enable row level security;

create policy "jobs_select_own"
  on public.jobs for select
  using (auth.uid() = user_id);

-- İstemcinin Realtime üzerinden iş durumunu (pending/processing/done/failed)
-- anlık takip edebilmesi için (Bölüm 3, Özellik 1 ve Bölüm 7 Ajan 3 DoD'si).
alter publication supabase_realtime add table public.jobs;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute procedure public.set_updated_at();
