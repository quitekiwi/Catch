-- Catch: the database gives every new link its session number, one at a time per person,
-- so catches from different devices or the Shortcut can never get the same number.
-- Numbers are never reused: the next one is above both the highest link and the counter.
create or replace function public.assign_session_no() returns trigger
language plpgsql security definer set search_path = public as $$
declare top int;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select greatest(
    coalesce((select max(session_no) from public.links where user_id = new.user_id), 0),
    coalesce((select nullif(value, '')::int from public.meta where user_id = new.user_id and key = 'counter'), 0)
  ) into top;
  new.session_no := top + 1;
  insert into public.meta (user_id, key, value) values (new.user_id, 'counter', new.session_no::text)
    on conflict (user_id, key) do update set value = excluded.value;
  return new;
end $$;
drop trigger if exists links_session_no on public.links;
create trigger links_session_no before insert on public.links
  for each row execute function public.assign_session_no();

-- older app versions also set the counter themselves; never let that move it backwards
create or replace function public.keep_counter_rising() returns trigger
language plpgsql as $$
begin
  if new.key = 'counter' and old.value ~ '^\d+$' and new.value ~ '^\d+$' and new.value::int < old.value::int then
    new.value := old.value;
  end if;
  return new;
end $$;
drop trigger if exists meta_counter_rising on public.meta;
create trigger meta_counter_rising before update on public.meta
  for each row execute function public.keep_counter_rising();
