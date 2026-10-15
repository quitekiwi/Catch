-- Catch: private per-person archives.
-- Paste each part into Supabase → SQL Editor and press Run, at the moment the steps say.

------------------------------------------------------------------
-- PART A — run first. Safe while the old (no sign-in) site is live:
-- it only adds an "owner" column to each table.
------------------------------------------------------------------
alter table public.links   add column if not exists user_id uuid default auth.uid() references auth.users on delete cascade;
alter table public.folders add column if not exists user_id uuid default auth.uid() references auth.users on delete cascade;
alter table public.meta    add column if not exists user_id uuid default auth.uid() references auth.users on delete cascade;

-- the session counter becomes one per person
do $$ declare c text; begin
  select conname into c from pg_constraint where conrelid = 'public.meta'::regclass and contype = 'p';
  if c is not null then execute format('alter table public.meta drop constraint %I', c); end if;
end $$;
alter table public.meta drop constraint if exists meta_user_key;
alter table public.meta add constraint meta_user_key unique nulls not distinct (user_id, key);


------------------------------------------------------------------
-- PART B — run after you've signed in once on the new site.
-- Replace YOUR-EMAIL below with the email you signed in with.
------------------------------------------------------------------
do $$ declare owner uuid; begin
  select id into owner from auth.users where email = 'YOUR-EMAIL';
  if owner is null then raise exception 'No account with that email yet: sign in on the new site first'; end if;

  -- everything saved before accounts existed belongs to the owner
  update public.links   set user_id = owner where user_id is null;
  update public.folders set user_id = owner where user_id is null;
  delete from public.meta m where m.user_id is null
    and exists (select 1 from public.meta o where o.user_id = owner and o.key = m.key
                and coalesce(nullif(o.value,'')::int, 0) >= coalesce(nullif(m.value,'')::int, 0));
  delete from public.meta o where o.user_id = owner and exists (select 1 from public.meta m where m.user_id is null and m.key = o.key);
  update public.meta set user_id = owner where user_id is null;
end $$;

alter table public.links   alter column user_id set not null;
alter table public.folders alter column user_id set not null;
alter table public.meta    alter column user_id set not null;

-- clear out any old "anyone can do anything" rules
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('links','folders','meta') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- each person can only see and change their own rows
alter table public.links   enable row level security;
alter table public.folders enable row level security;
alter table public.meta    enable row level security;
create policy "own links"   on public.links   for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own folders" on public.folders for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own meta"    on public.meta    for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.links, public.folders, public.meta from anon;
