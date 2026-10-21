-- Match history and stats count online matches only: VS CPU results would inflate win rates.
alter table public.match_results add constraint match_results_online_only check (mode = 'online');

create or replace view public.player_stats with (security_invoker = true) as
  select user_id,
         count(*)::int                                        as games,
         count(*) filter (where won)::int                     as wins,
         count(*) filter (where mode = 'online')::int         as online_games,
         count(*) filter (where mode = 'online' and won)::int as online_wins,
         mode() within group (order by my_runner)             as main_runner,
         count(*) filter (where not won)::int                 as losses
  from public.match_results
  where mode = 'online'
  group by user_id;
