"""Writes game/supabase/004_name_filter.sql from the word list in game/src/namefilter.js, so the game and the
database always block the same names. Re-run after editing the list, then apply the SQL in Supabase."""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import re, json
src = open(ROOT+'/src/namefilter.js').read()
block = re.search(r'const NAME_BLOCK = \{(.*?)\n\};', src, re.S).group(1)
words = {m: re.findall(r"'([a-z]+)'", re.search(m + r': \[(.*?)\]', block, re.S).group(1)) for m in 'SEX'}
seed = ',\n  '.join(f"('{w}', '{m}')" for m in 'SEX' for w in words[m])
sql = f"""-- Display-name filter: blocks slurs and swear words in account names (made by tools/make_name_filter_sql.py).
-- Same list and rules as game/src/namefilter.js. Words can also be added later straight from the table editor:
--   insert into public.name_blocklist values ('word', 'S');   -- S anywhere · E start/end of a word · X whole word only

create table if not exists public.name_blocklist (
  word text primary key check (word ~ '^[a-z]+$'),
  mode char(1) not null check (mode in ('S', 'E', 'X'))
);
alter table public.name_blocklist enable row level security;   -- no policies: nobody reads it through the API
insert into public.name_blocklist (word, mode) values
  {seed}
on conflict (word) do update set mode = excluded.mode;

-- lower case, leet digits swapped (1 is tried as both i and l), letters only
create or replace function public.name_clean(s text, one text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(translate(lower(s), '034567891', 'oeasgtbg' || one), '[^a-z]', '', 'g');
$$;
create or replace function public.name_collapse(s text) returns text
language sql immutable set search_path = '' as $$ select regexp_replace(s, '(.)\\1+', '\\1', 'g'); $$;

create or replace function public.name_blocked(n text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare one text; whole text; t0 text; t text;
begin
  foreach one in array array['i', 'l'] loop
    whole := public.name_clean(n, one);
    if exists (select 1 from public.name_blocklist b where b.mode = 'S'
               and (strpos(whole, b.word) > 0 or strpos(public.name_collapse(whole), public.name_collapse(b.word)) > 0)) then
      return true;
    end if;
    -- each word (split on spaces _ . - and camelCase), plus the whole name
    for t0 in select public.name_clean(w, one) from regexp_split_to_table(regexp_replace(n, '([a-z])([A-Z])', '\\1 \\2', 'g'), '[ _.\\-]+') w where w <> ''
              union all select whole loop
      foreach t in array array[t0, public.name_collapse(t0)] loop
        if t <> '' and exists (select 1 from public.name_blocklist b where
             (b.mode = 'E' and (left(t, length(b.word)) = b.word or right(t, length(b.word)) = b.word))
          or (b.mode = 'X' and (t = b.word or t = b.word || 's'))) then
          return true;
        end if;
      end loop;
    end loop;
  end loop;
  return false;
end $$;
revoke execute on function public.name_blocked(text) from public;
grant execute on function public.name_blocked(text) to anon, authenticated;

-- new names and renames are checked by the database too, so the filter can't be skipped
create or replace function public.profiles_name_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.name_blocked(new.name) then raise exception 'name_blocked' using errcode = '23514'; end if;
  return new;
end $$;
drop trigger if exists profiles_name_check on public.profiles;
create trigger profiles_name_check before insert or update of name on public.profiles
  for each row execute function public.profiles_name_check();

-- sign-up: a blocked name becomes "Runner" (plus a number if taken) instead of failing the whole sign-up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  want text := btrim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  fav  text := coalesce(new.raw_user_meta_data ->> 'fav_runner', 'spe');
begin
  if want !~ '^[A-Za-z0-9_. -]{{3,16}}$' or public.name_blocked(want) then want := 'Runner'; end if;
  if not public.valid_runner(fav) then fav := 'spe'; end if;
  if exists (select 1 from public.profiles where lower(name) = lower(want)) then
    want := left(want, 11) || '-' || (floor(random() * 9000) + 1000)::int;
  end if;
  insert into public.profiles (id, name, fav_runner) values (new.id, want, fav);
  insert into public.settings (user_id) values (new.id);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.name_available(n text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select btrim(n) ~ '^[A-Za-z0-9_. -]{{3,16}}$' and not public.name_blocked(btrim(n))
     and not exists (select 1 from public.profiles where lower(name) = lower(btrim(n)));
$$;
"""
open(ROOT+'/supabase/004_name_filter.sql', 'w').write(sql)
print('wrote 004_name_filter.sql with', sum(map(len, words.values())), 'words')
