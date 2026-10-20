-- =====================================================================
--  Il Tavolo — D&D 5e · Setup del database Supabase (versione 2)
-- ---------------------------------------------------------------------
--  Come si usa: Supabase → SQL Editor → New query → incolla TUTTO questo
--  file → Run. Si può rieseguire quando vuoi: non cancella niente.
--
--  Cosa crea:
--   • tavolo_entities  → i pezzi di ogni campagna (pedine, schede, diario…),
--                        una riga per pezzo, così due persone che modificano
--                        cose diverse nello stesso momento non si sovrascrivono.
--   • tavolo_dm_vault  → la "cassaforte" del Master (note segrete, nemici
--                        preparati, password). I giocatori NON possono leggerla:
--                        si apre solo tramite le funzioni qui sotto, con la
--                        password giusta.
--  Se esiste la vecchia tabella "campaigns", le campagne vengono copiate nel
--  nuovo formato e la vecchia tabella viene resa illeggibile dal sito (conteneva
--  le password in chiaro). I dati restano lì come backup.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Pezzi delle campagne
-- ---------------------------------------------------------------------
create sequence if not exists public.tavolo_rev_seq;

create table if not exists public.tavolo_entities (
  campaign_id text        not null,
  key         text        not null,
  data        jsonb       not null default '{}'::jsonb,
  rev         bigint      not null default 0,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (campaign_id, key)
);

create index if not exists tavolo_entities_rev_idx on public.tavolo_entities (campaign_id, rev);
create index if not exists tavolo_entities_key_idx on public.tavolo_entities (key);

-- Ogni scrittura riceve un numero di revisione crescente: i dispositivi lo
-- usano per capire cosa è cambiato.
create or replace function public.tavolo_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.rev := nextval('public.tavolo_rev_seq');
  new.updated_at := now();
  return new;
end
$$;
revoke execute on function public.tavolo_touch() from public, anon, authenticated;

drop trigger if exists tavolo_entities_touch on public.tavolo_entities;
create trigger tavolo_entities_touch
  before insert or update on public.tavolo_entities
  for each row execute function public.tavolo_touch();

-- Niente login: chi ha il link del sito può leggere e modificare le campagne.
alter table public.tavolo_entities enable row level security;
drop policy if exists tavolo_entities_open on public.tavolo_entities;
create policy tavolo_entities_open on public.tavolo_entities
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.tavolo_entities to anon, authenticated;

-- Aggiornamenti in tempo reale
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables)
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tavolo_entities'
     ) then
    alter publication supabase_realtime add table public.tavolo_entities;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 2. Cassaforte del Master
-- ---------------------------------------------------------------------
create table if not exists public.tavolo_dm_vault (
  campaign_id text primary key,
  pwd_hash    text,                      -- null = avventura senza password
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.tavolo_dm_vault enable row level security;  -- nessuna policy: nessun accesso diretto
revoke all on public.tavolo_dm_vault from anon, authenticated;

create or replace function public.tavolo_pwd_ok(p_hash text, p_password text)
returns boolean
language sql
stable
set search_path = public, extensions
as $$
  select p_hash is null or p_hash = extensions.crypt(coalesce(p_password, ''), p_hash)
$$;
revoke execute on function public.tavolo_pwd_ok(text, text) from public, anon, authenticated;

create or replace function public.tavolo_hash(p_password text)
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select case when coalesce(p_password, '') = '' then null
              else extensions.crypt(p_password, extensions.gen_salt('bf')) end
$$;
revoke execute on function public.tavolo_hash(text) from public, anon, authenticated;

create or replace function public.tavolo_set_meta_password_flag(p_campaign text, p_has boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tavolo_entities
     set data = jsonb_set(data, '{hasPassword}', to_jsonb(p_has))
   where campaign_id = p_campaign and key = 'meta'
$$;
revoke execute on function public.tavolo_set_meta_password_flag(text, boolean) from public, anon, authenticated;

-- Crea la cassaforte di una nuova avventura (solo se non esiste già).
create or replace function public.tavolo_dm_create(p_campaign text, p_password text, p_data jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.tavolo_dm_vault (campaign_id, pwd_hash, data)
  values (p_campaign, public.tavolo_hash(p_password), coalesce(p_data, '{}'::jsonb))
  on conflict (campaign_id) do nothing;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;
  perform public.tavolo_set_meta_password_flag(p_campaign, coalesce(p_password, '') <> '');
  return jsonb_build_object('ok', true);
end
$$;

-- Apre la cassaforte: restituisce i segreti solo con la password giusta.
create or replace function public.tavolo_dm_open(p_campaign text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v public.tavolo_dm_vault%rowtype;
begin
  select * into v from public.tavolo_dm_vault where campaign_id = p_campaign;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_vault');
  end if;
  if not public.tavolo_pwd_ok(v.pwd_hash, p_password) then
    perform pg_sleep(0.4);
    return jsonb_build_object('ok', false, 'reason', 'wrong_password');
  end if;
  return jsonb_build_object('ok', true, 'data', v.data, 'hasPassword', v.pwd_hash is not null);
end
$$;

create or replace function public.tavolo_dm_save(p_campaign text, p_password text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  select pwd_hash into v_hash from public.tavolo_dm_vault where campaign_id = p_campaign;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_vault');
  end if;
  if not public.tavolo_pwd_ok(v_hash, p_password) then
    perform pg_sleep(0.4);
    return jsonb_build_object('ok', false, 'reason', 'wrong_password');
  end if;
  update public.tavolo_dm_vault
     set data = coalesce(p_data, '{}'::jsonb), updated_at = now()
   where campaign_id = p_campaign;
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.tavolo_dm_set_password(p_campaign text, p_password text, p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  select pwd_hash into v_hash from public.tavolo_dm_vault where campaign_id = p_campaign;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_vault');
  end if;
  if not public.tavolo_pwd_ok(v_hash, p_password) then
    perform pg_sleep(0.4);
    return jsonb_build_object('ok', false, 'reason', 'wrong_password');
  end if;
  update public.tavolo_dm_vault
     set pwd_hash = public.tavolo_hash(p_new_password), updated_at = now()
   where campaign_id = p_campaign;
  perform public.tavolo_set_meta_password_flag(p_campaign, coalesce(p_new_password, '') <> '');
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.tavolo_delete_campaign(p_campaign text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  select pwd_hash into v_hash from public.tavolo_dm_vault where campaign_id = p_campaign;
  if found and not public.tavolo_pwd_ok(v_hash, p_password) then
    perform pg_sleep(0.4);
    return jsonb_build_object('ok', false, 'reason', 'wrong_password');
  end if;
  delete from public.tavolo_entities where campaign_id = p_campaign;
  delete from public.tavolo_dm_vault where campaign_id = p_campaign;
  return jsonb_build_object('ok', true);
end
$$;

revoke execute on function public.tavolo_dm_create(text, text, jsonb) from public;
revoke execute on function public.tavolo_dm_open(text, text) from public;
revoke execute on function public.tavolo_dm_save(text, text, jsonb) from public;
revoke execute on function public.tavolo_dm_set_password(text, text, text) from public;
revoke execute on function public.tavolo_delete_campaign(text, text) from public;
grant execute on function public.tavolo_dm_create(text, text, jsonb) to anon, authenticated;
grant execute on function public.tavolo_dm_open(text, text) to anon, authenticated;
grant execute on function public.tavolo_dm_save(text, text, jsonb) to anon, authenticated;
grant execute on function public.tavolo_dm_set_password(text, text, text) to anon, authenticated;
grant execute on function public.tavolo_delete_campaign(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Migrazione dalla vecchia tabella "campaigns" (se c'è)
-- ---------------------------------------------------------------------
do $mig$
declare
  v_count int;
begin
  if to_regclass('public.campaigns') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'campaigns' and column_name = 'data'
     ) then
    return;
  end if;

  create temporary table tavolo_legacy on commit drop as
  select c.id::text as id,
         coalesce(nullif(to_jsonb(c) ->> 'name', ''), c.data ->> 'title', 'Campagna') as title,
         coalesce(c.data, '{}'::jsonb) as d
    from public.campaigns c
   where c.id is not null;

  insert into public.tavolo_entities (campaign_id, key, data, updated_by)
  select id, 'meta',
         jsonb_build_object(
           'title', title,
           'createdAt', case when d ->> 'updatedAt' ~ '^\d+$' then (d ->> 'updatedAt')::bigint
                             else (extract(epoch from now()) * 1000)::bigint end,
           'hasPassword', coalesce(d -> 'dmState' ->> 'password', '') <> ''
         ),
         'migrazione-v1'
    from tavolo_legacy
  on conflict do nothing;

  insert into public.tavolo_entities (campaign_id, key, data, updated_by)
  select id, 'scene', coalesce(d -> 'scene', '{}'::jsonb) - 'mapDataUrl', 'migrazione-v1'
    from tavolo_legacy
  on conflict do nothing;

  insert into public.tavolo_entities (campaign_id, key, data, updated_by)
  select id, 'map', jsonb_build_object('dataUrl', d -> 'scene' ->> 'mapDataUrl'), 'migrazione-v1'
    from tavolo_legacy
   where coalesce(d -> 'scene' ->> 'mapDataUrl', '') <> ''
  on conflict do nothing;

  insert into public.tavolo_entities (campaign_id, key, data, updated_by)
  select l.id, 'char:' || (e ->> 'id'), e, 'migrazione-v1'
    from tavolo_legacy l
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(l.d -> 'chars') = 'array' then l.d -> 'chars' else '[]'::jsonb end) e
   where coalesce(e ->> 'id', '') <> ''
  on conflict do nothing;

  insert into public.tavolo_entities (campaign_id, key, data, updated_by)
  select l.id, 'token:' || (e ->> 'id'), e, 'migrazione-v1'
    from tavolo_legacy l
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(l.d -> 'tokens') = 'array' then l.d -> 'tokens' else '[]'::jsonb end) e
   where coalesce(e ->> 'id', '') <> ''
  on conflict do nothing;

  insert into public.tavolo_entities (campaign_id, key, data, updated_by)
  select l.id, 'journal:' || (e ->> 'id'), e, 'migrazione-v1'
    from tavolo_legacy l
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(l.d -> 'journal') = 'array' then l.d -> 'journal' else '[]'::jsonb end) e
   where coalesce(e ->> 'id', '') <> ''
  on conflict do nothing;

  insert into public.tavolo_entities (campaign_id, key, data, updated_by)
  select l.id, 'init:' || (e ->> 'id'), e, 'migrazione-v1'
    from tavolo_legacy l
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(l.d -> 'init') = 'array' then l.d -> 'init' else '[]'::jsonb end) e
   where coalesce(e ->> 'id', '') <> ''
  on conflict do nothing;

  insert into public.tavolo_entities (campaign_id, key, data, updated_by)
  select id, 'initmeta',
         jsonb_build_object(
           'round', coalesce(d -> 'initMeta' -> 'round', '1'::jsonb),
           'inCombat', coalesce(d -> 'initMeta' -> 'inCombat', 'false'::jsonb),
           'activeId', case when jsonb_typeof(d -> 'init') = 'array'
                             and coalesce(d -> 'initMeta' ->> 'activeIndex', '0') ~ '^\d+$'
                            then d -> 'init' -> (coalesce(d -> 'initMeta' ->> 'activeIndex', '0'))::int -> 'id'
                       end
         ),
         'migrazione-v1'
    from tavolo_legacy
  on conflict do nothing;

  insert into public.tavolo_dm_vault (campaign_id, pwd_hash, data)
  select id,
         public.tavolo_hash(d -> 'dmState' ->> 'password'),
         jsonb_build_object(
           'secretNotes', coalesce(d -> 'dmState' ->> 'secretNotes', ''),
           'sessionNotes', '',
           'enemies', case when jsonb_typeof(d -> 'enemies') = 'array' then d -> 'enemies' else '[]'::jsonb end,
           'partyCount', d -> 'dmState' -> 'partyCount',
           'partyLevel', d -> 'dmState' -> 'partyAvgLevel'
         )
    from tavolo_legacy
  on conflict do nothing;

  get diagnostics v_count = row_count;
  raise notice 'Il Tavolo: migrate % campagne dalla vecchia tabella "campaigns".', v_count;

  -- La vecchia tabella conteneva password e note segrete leggibili da tutti:
  -- da ora il sito non può più leggerla (resta nel database come backup).
  execute 'revoke all on public.campaigns from anon, authenticated';
end
$mig$;
