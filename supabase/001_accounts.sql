-- Uma Versus accounts (Update 1.8): applied to the uma-versus Supabase project.
-- Profiles are public (names show up online), settings are private, and each player can
-- only add results to their own match history.

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  fav_runner  text not null default 'spe',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint name_format check (name ~ '^[A-Za-z0-9_. -]{3,16}$' and name = btrim(name)),
  constraint fav_runner_valid check (fav_runner in ('spe','suz','gs','vo','ds','mm','tt','kb'))
);
create unique index profiles_name_unique on public.profiles (lower(name));
alter table public.profiles enable row level security;
create policy "profiles are public" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create table public.settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint settings_size check (pg_column_size(data) < 65536)
);
alter table public.settings enable row level security;
create policy "read own settings" on public.settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "write own settings" on public.settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "create own settings" on public.settings for insert to authenticated with check ((select auth.uid()) = user_id);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();

-- the profile is created with the account (name + runner come from the sign-up form)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  want text := btrim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  fav  text := coalesce(new.raw_user_meta_data ->> 'fav_runner', 'spe');
begin
  if want !~ '^[A-Za-z0-9_. -]{3,16}$' then want := 'Runner'; end if;
  if fav not in ('spe','suz','gs','vo','ds','mm','tt','kb') then fav := 'spe'; end if;
  -- if the name was taken in the meantime, add a number instead of failing the sign-up
  if exists (select 1 from public.profiles where lower(name) = lower(want)) then
    want := left(want, 11) || '-' || (floor(random() * 9000) + 1000)::int;
  end if;
  insert into public.profiles (id, name, fav_runner) values (new.id, want, fav);
  insert into public.settings (user_id) values (new.id);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- is a display name free? (the sign-up form checks before creating the account)
create function public.name_available(n text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select btrim(n) ~ '^[A-Za-z0-9_. -]{3,16}$' and not exists (select 1 from public.profiles where lower(name) = lower(btrim(n)));
$$;
revoke execute on function public.name_available(text) from public;
grant execute on function public.name_available(text) to anon, authenticated;

create table public.match_results (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  match_key    text not null check (length(match_key) <= 80),   -- same key on both players' rows for an online match
  mode         text not null check (mode in ('online', 'cpu')),
  build        text not null check (length(build) <= 16),
  my_runner    text not null check (my_runner in ('spe','suz','gs','vo','ds','mm','tt','kb')),
  opp_runner   text not null check (opp_runner in ('spe','suz','gs','vo','ds','mm','tt','kb')),
  opp_id       uuid references auth.users (id) on delete set null,
  opp_name     text check (length(opp_name) <= 24),
  won          boolean not null,
  rounds_won   smallint not null check (rounds_won between 0 and 3),
  rounds_lost  smallint not null check (rounds_lost between 0 and 3),
  stage        smallint,
  created_at   timestamptz not null default now(),
  unique (user_id, match_key)
);
create index match_results_user_time on public.match_results (user_id, created_at desc);
create index match_results_opp on public.match_results (opp_id);
alter table public.match_results enable row level security;
create policy "results are public" on public.match_results for select using (true);
create policy "record own results" on public.match_results for insert to authenticated with check ((select auth.uid()) = user_id);

create view public.player_stats with (security_invoker = true) as
  select user_id,
         count(*)::int                                        as games,
         count(*) filter (where won)::int                     as wins,
         count(*) filter (where mode = 'online')::int         as online_games,
         count(*) filter (where mode = 'online' and won)::int as online_wins,
         mode() within group (order by my_runner)             as main_runner
  from public.match_results group by user_id;
grant select on public.player_stats to anon, authenticated;
