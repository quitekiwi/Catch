-- Catch: shared shelves (one folder, read-only, by private link).
-- Run in Supabase → SQL Editor AFTER accounts.sql Part B.

create table if not exists public.shares (
  token      text primary key default replace(gen_random_uuid()::text, '-', ''),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  folder_id  text not null,
  room       text,
  created_at timestamptz not null default now(),
  unique (user_id, folder_id)
);
alter table public.shares enable row level security;
drop policy if exists "own shares" on public.shares;
create policy "own shares" on public.shares for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.shares from anon;

-- what a shared link shows: the folder's name, the room it was shared from, and its links
-- (never whether they've been read, and nothing outside that folder)
create or replace function public.shared_shelf(share_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'folder', f.name,
    'room', s.room,
    'links', coalesce((
      select json_agg(json_build_object('id', l.id, 'url', l.url, 'session_no', l.session_no, 'name', l.name,
                                        'domain', l.domain, 'added_at', l.added_at, 'art', l.art) order by l.session_no desc)
      from public.links l where l.user_id = s.user_id and l.folder_id = s.folder_id), '[]'::json))
  from public.shares s
  join public.folders f on f.id = s.folder_id and f.user_id = s.user_id
  where s.token = share_token;
$$;
revoke all on function public.shared_shelf(text) from public;
grant execute on function public.shared_shelf(text) to anon, authenticated;
