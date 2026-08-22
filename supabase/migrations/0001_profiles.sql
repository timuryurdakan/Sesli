-- Stage 02 (Ajan 2 — Kimlik Doğrulama ve Kullanıcı Yönetimi)
-- profiles tablosu: her auth.users satırına 1:1 karşılık gelir.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  instrument text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Her kullanıcı yalnızca kendi profilini okuyabilir.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Her kullanıcı yalnızca kendi profilini güncelleyebilir.
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Yeni kullanıcı kaydında otomatik profil satırı oluşturan trigger.
-- SECURITY DEFINER ile çalışır, bu yüzden ayrı bir "insert" RLS politikasına gerek yoktur
-- (kullanıcılar kendi profillerini doğrudan insert edemez, yalnızca bu trigger üretir).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
