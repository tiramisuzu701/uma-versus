-- 2.0.1 leaderboards:
--  * matches against Guests count (they can't be confirmed by the other side, so they're taken as reported)
--  * a match both players reported counts even if one side missed the other's account id (they share the match key,
--    which includes a random per-session part, and report opposite results)
create or replace view public.leaderboard with (security_invoker = true) as
  with confirmed as (
    select r.user_id, r.won, r.my_runner from public.match_results r
    where r.mode = 'online' and (
      -- both players reported it
      exists (select 1 from public.match_results o
              where o.match_key = r.match_key and o.user_id <> r.user_id and o.won <> r.won
                and (r.opp_id is null or o.user_id = r.opp_id))
      -- against a Guest: nobody else can report it
      or (r.opp_id is null and r.opp_name = 'Guest'
          and not exists (select 1 from public.match_results o where o.match_key = r.match_key and o.user_id <> r.user_id))
    )
  )
  select c.user_id, p.name, p.fav_runner,
         count(*)::int as games,
         count(*) filter (where c.won)::int as wins,
         round(100.0 * count(*) filter (where c.won) / count(*))::int as win_rate,
         mode() within group (order by c.my_runner) as main_runner
  from confirmed c join public.profiles p on p.id = c.user_id
  group by c.user_id, p.name, p.fav_runner;
grant select on public.leaderboard to anon, authenticated;
