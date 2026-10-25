-- Uma Versus Update 2: four new runners, the public room list, friends (with presence and invites)
-- and leaderboards.

-- ---------------------------------------------------------------- runners
create or replace function public.valid_runner(r text) returns boolean
language sql immutable set search_path = '' as $$
  select r in ('spe','suz','gs','vo','ds','mm','tt','kb','jp','at','mc','df')
$$;
alter table public.profiles drop constraint fav_runner_valid;
alter table public.profiles add constraint fav_runner_valid check (public.valid_runner(fav_runner));
alter table public.match_results drop constraint match_results_my_runner_check;
alter table public.match_results drop constraint match_results_opp_runner_check;
alter table public.match_results add constraint match_results_my_runner_check check (public.valid_runner(my_runner));
alter table public.match_results add constraint match_results_opp_runner_check check (public.valid_runner(opp_runner));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  want text := btrim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  fav  text := coalesce(new.raw_user_meta_data ->> 'fav_runner', 'spe');
begin
  if want !~ '^[A-Za-z0-9_. -]{3,16}$' then want := 'Runner'; end if;
  if not public.valid_runner(fav) then fav := 'spe'; end if;
  if exists (select 1 from public.profiles where lower(name) = lower(want)) then
    want := left(want, 11) || '-' || (floor(random() * 9000) + 1000)::int;
  end if;
  insert into public.profiles (id, name, fav_runner) values (new.id, want, fav);
  insert into public.settings (user_id) values (new.id);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------- public room list
-- Hosts (signed in or not) list their room through room_open / room_close. The host's secret lives
-- in room_keys, which nobody can read, so only the host can update or close a listing.
create table public.rooms (
  code        text primary key check (code ~ '^[A-Z2-9]{5}$'),
  host_name   text not null check (length(host_name) between 1 and 16),
  build       text not null check (length(build) <= 16),
  spectate    boolean not null default true,
  status      text not null default 'open' check (status in ('open', 'playing')),
  watchers    smallint not null default 0 check (watchers between 0 and 8),
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index rooms_seen on public.rooms (last_seen desc);
alter table public.rooms enable row level security;
create policy "rooms are public" on public.rooms for select using (last_seen > now() - interval '45 seconds');

create table public.room_keys (code text primary key references public.rooms (code) on delete cascade, secret_hash text not null);
alter table public.room_keys enable row level security;   -- no policies: only the functions below touch it

create function public.room_open(p_code text, p_name text, p_build text, p_spectate boolean, p_status text, p_watchers int, p_secret text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare h text := md5(p_secret || ':' || p_code); k text;
begin
  if length(coalesce(p_secret, '')) < 16 then return false; end if;
  delete from public.rooms where last_seen < now() - interval '10 minutes';
  select secret_hash into k from public.room_keys where code = p_code;
  if k is not null and k <> h then return false; end if;   -- someone else's room
  insert into public.rooms (code, host_name, build, spectate, status, watchers, last_seen)
    values (p_code, left(btrim(regexp_replace(coalesce(p_name, 'Guest'), '[^A-Za-z0-9_. -]', '', 'g')), 16), left(p_build, 16), p_spectate, p_status, least(8, greatest(0, p_watchers)), now())
    on conflict (code) do update set host_name = excluded.host_name, build = excluded.build, spectate = excluded.spectate,
      status = excluded.status, watchers = excluded.watchers, last_seen = now();
  insert into public.room_keys (code, secret_hash) values (p_code, h) on conflict (code) do nothing;
  return true;
end $$;
create function public.room_close(p_code text, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.rooms r using public.room_keys k where r.code = p_code and k.code = p_code and k.secret_hash = md5(p_secret || ':' || p_code);
end $$;
revoke execute on function public.room_open(text, text, text, boolean, text, int, text) from public;
revoke execute on function public.room_close(text, text) from public;
grant execute on function public.room_open(text, text, text, boolean, text, int, text) to anon, authenticated;
grant execute on function public.room_close(text, text) to anon, authenticated;

-- ---------------------------------------------------------------- friends
-- Adding someone sends a request; once both have added each other they're friends and can see
-- each other's presence and send invites.
create table public.friends (
  user_id    uuid not null references auth.users (id) on delete cascade,
  friend_id  uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index friends_rev on public.friends (friend_id);
alter table public.friends enable row level security;
create policy "see your own friend rows" on public.friends for select to authenticated
  using ((select auth.uid()) in (user_id, friend_id));
create policy "add friends" on public.friends for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "remove friends" on public.friends for delete to authenticated using ((select auth.uid()) = user_id);

create function public.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friends where user_id = a and friend_id = b)
     and exists (select 1 from public.friends where user_id = b and friend_id = a)
$$;
revoke execute on function public.is_friend(uuid, uuid) from public, anon;
grant execute on function public.is_friend(uuid, uuid) to authenticated;

-- add by display name; returns 'added', 'friends' (they had already added you), 'self' or 'none'
create function public.add_friend(n text) returns text
language plpgsql security invoker set search_path = '' as $$
declare me uuid := auth.uid(); them uuid;
begin
  if me is null then return 'none'; end if;
  select id into them from public.profiles where lower(name) = lower(btrim(n));
  if them is null then return 'none'; end if;
  if them = me then return 'self'; end if;
  insert into public.friends (user_id, friend_id) values (me, them) on conflict do nothing;
  return case when public.is_friend(me, them) then 'friends' else 'added' end;
end $$;
revoke execute on function public.add_friend(text) from public, anon;
grant execute on function public.add_friend(text) to authenticated;

-- presence: last time the game was open, and the room code if hosting. Friends only.
create table public.presence (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  last_seen  timestamptz not null default now(),
  room_code  text check (room_code ~ '^[A-Z2-9]{5}$')
);
alter table public.presence enable row level security;
create policy "friends see presence" on public.presence for select to authenticated
  using ((select auth.uid()) = user_id or public.is_friend((select auth.uid()), user_id));
create policy "write own presence" on public.presence for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own presence" on public.presence for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- invites to a room, friend to friend; they expire on their own after a couple of minutes
create table public.invites (
  id         bigint generated always as identity primary key,
  from_id    uuid not null references auth.users (id) on delete cascade,
  to_id      uuid not null references auth.users (id) on delete cascade,
  room_code  text not null check (room_code ~ '^[A-Z2-9]{5}$'),
  created_at timestamptz not null default now()
);
create index invites_to on public.invites (to_id, created_at desc);
alter table public.invites enable row level security;
create policy "see invites you sent or got" on public.invites for select to authenticated
  using ((select auth.uid()) in (from_id, to_id) and created_at > now() - interval '3 minutes');
create policy "invite a friend" on public.invites for insert to authenticated
  with check ((select auth.uid()) = from_id and public.is_friend(from_id, to_id));
create policy "clear your invites" on public.invites for delete to authenticated using ((select auth.uid()) in (from_id, to_id));

-- ---------------------------------------------------------------- leaderboards
-- Only matches both players recorded (same match key, opposite results) count, so a result can't be
-- made up from one account.
create index match_results_key on public.match_results (match_key);
create view public.leaderboard with (security_invoker = true) as
  with confirmed as (
    select r.user_id, r.won, r.my_runner from public.match_results r
    where r.mode = 'online' and r.opp_id is not null
      and exists (select 1 from public.match_results o
                  where o.match_key = r.match_key and o.user_id = r.opp_id and o.opp_id = r.user_id and o.won <> r.won)
  )
  select c.user_id, p.name, p.fav_runner,
         count(*)::int as games,
         count(*) filter (where c.won)::int as wins,
         round(100.0 * count(*) filter (where c.won) / count(*))::int as win_rate,
         mode() within group (order by c.my_runner) as main_runner
  from confirmed c join public.profiles p on p.id = c.user_id
  group by c.user_id, p.name, p.fav_runner;
grant select on public.leaderboard to anon, authenticated;
