-- Catch: keys for the iPhone Shortcut (one per person; only a fingerprint of the key is stored).
create table if not exists public.shortcut_keys (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  key_hash   text not null unique,
  created_at timestamptz not null default now()
);
alter table public.shortcut_keys enable row level security;
drop policy if exists "own shortcut key" on public.shortcut_keys;
create policy "own shortcut key" on public.shortcut_keys for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.shortcut_keys from anon;
