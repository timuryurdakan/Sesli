-- Stage 08 (Ajan 8 — Çalma Listeleri, Proje Yönetimi ve Bulut Senkronizasyonu)

-- Arama/filtreleme için (parça adı zaten "tracks.title"da var).
alter table public.tracks add column if not exists artist text;
alter table public.tracks add column if not exists tags text[] not null default '{}';

-- Depolama kotası (Bölüm 7 Ajan 8 / Bölüm 9.4): kullanıcı başına toplam
-- depolama kullanımını hesaplayabilmek için normalize edilmiş dosyanın
-- boyutu (bkz. apps/api/src/uploads/tus-upload.middleware.ts).
alter table public.tracks add column if not exists size_bytes bigint;

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.playlists enable row level security;

create policy "playlists_select_own"
  on public.playlists for select
  using (auth.uid() = user_id);

create policy "playlists_insert_own"
  on public.playlists for insert
  with check (auth.uid() = user_id);

create policy "playlists_update_own"
  on public.playlists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "playlists_delete_own"
  on public.playlists for delete
  using (auth.uid() = user_id);

create trigger playlists_set_updated_at
  before update on public.playlists
  for each row execute procedure public.set_updated_at();

create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (playlist_id, track_id)
);

alter table public.playlist_tracks enable row level security;

-- playlist_tracks'ın kendi user_id'si yok; sahiplik playlists üzerinden
-- (join ile) kontrol edilir.
create policy "playlist_tracks_select_own"
  on public.playlist_tracks for select
  using (exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.user_id = auth.uid()
  ));

create policy "playlist_tracks_insert_own"
  on public.playlist_tracks for insert
  with check (exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.user_id = auth.uid()
  ));

create policy "playlist_tracks_update_own"
  on public.playlist_tracks for update
  using (exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.user_id = auth.uid()
  ));

create policy "playlist_tracks_delete_own"
  on public.playlist_tracks for delete
  using (exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.user_id = auth.uid()
  ));

-- Özellik 7 (bulut senkronizasyonu): istemci bu tablolara doğrudan Supabase
-- Realtime ile abone olur (RLS sayesinde yalnızca kendi satırlarını görür),
-- bu yüzden Realtime publication'a eklenmeleri gerekiyor.
alter publication supabase_realtime add table public.playlists;
alter publication supabase_realtime add table public.playlist_tracks;
