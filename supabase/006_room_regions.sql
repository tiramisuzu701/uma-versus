-- 2.0.x: rooms show the host's region (picked when hosting). Run once in the Supabase SQL editor.
-- Older game builds keep using the 7-argument room_open, so both versions stay.
alter table public.rooms add column if not exists region text
  check (region is null or region in ('nae', 'naw', 'sa', 'eu', 'me', 'as', 'oc', 'af'));

create or replace function public.room_open(p_code text, p_name text, p_build text, p_spectate boolean, p_status text, p_watchers int, p_secret text, p_region text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare ok boolean; r text := case when p_region in ('nae', 'naw', 'sa', 'eu', 'me', 'as', 'oc', 'af') then p_region else null end;
begin
  ok := public.room_open(p_code, p_name, p_build, p_spectate, p_status, p_watchers, p_secret);
  if ok then update public.rooms set region = r where code = p_code; end if;
  return ok;
end $$;
revoke execute on function public.room_open(text, text, text, boolean, text, int, text, text) from public;
grant execute on function public.room_open(text, text, text, boolean, text, int, text, text) to anon, authenticated;
