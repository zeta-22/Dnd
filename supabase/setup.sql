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
--   • codice del gruppo → facoltativo: chiude il tavolo ai soli amici che
--                        conoscono il codice (vedi sezione 0).
--  Se esiste la vecchia tabella "campaigns", le campagne vengono copiate nel
--  nuovo formato e la vecchia tabella viene resa illeggibile dal sito (conteneva
--  le password in chiaro). I dati restano lì come backup.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 0. Codice del gruppo (facoltativo)
-- ---------------------------------------------------------------------
-- Finché non imposti un codice, chiunque abbia il link del sito può entrare.
-- Per riservare il tavolo al tuo gruppo:
--   1) Supabase → Authentication → Sign In / Providers → attiva
--      "Allow anonymous sign-ins" e salva;
--   2) SQL Editor → esegui:   select tavolo_set_group_code('il-vostro-codice');
-- Ogni dispositivo dovrà scrivere il codice una volta (maiuscole e minuscole
-- non contano). Se cambi il codice, tutti dovranno inserire quello nuovo.
-- Per riaprire il tavolo a chiunque:   select tavolo_set_group_code(null);
create table if not exists public.tavolo_settings (
  id              int primary key default 1 check (id = 1),
  group_code_hash text
);
insert into public.tavolo_settings (id) values (1) on conflict do nothing;
alter table public.tavolo_settings enable row level security;  -- nessuna policy: nessun accesso diretto
revoke all on public.tavolo_settings from anon, authenticated;

create table if not exists public.tavolo_members (
  user_id   uuid primary key,
  joined_at timestamptz not null default now()
);
alter table public.tavolo_members enable row level security;
revoke all on public.tavolo_members from anon, authenticated;

-- Vero se il tavolo è aperto o se chi chiama ha già inserito il codice giusto
create or replace function public.tavolo_is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select group_code_hash from public.tavolo_settings where id = 1), '') = ''
      or exists (select 1 from public.tavolo_members where user_id = auth.uid())
$$;
revoke execute on function public.tavolo_is_member() from public;
grant execute on function public.tavolo_is_member() to anon, authenticated;

create or replace function public.tavolo_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'protected', coalesce((select group_code_hash from public.tavolo_settings where id = 1), '') <> '',
    'member', public.tavolo_is_member(),
    'signedIn', auth.uid() is not null)
$$;
revoke execute on function public.tavolo_access() from public;
grant execute on function public.tavolo_access() to anon, authenticated;

create or replace function public.tavolo_join(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  select group_code_hash into v_hash from public.tavolo_settings where id = 1;
  if coalesce(v_hash, '') = '' then
    return jsonb_build_object('ok', true);
  end if;
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if v_hash <> extensions.crypt(lower(trim(coalesce(p_code, ''))), v_hash) then
    perform pg_sleep(0.8);
    return jsonb_build_object('ok', false, 'reason', 'wrong_code');
  end if;
  insert into public.tavolo_members (user_id) values (auth.uid()) on conflict do nothing;
  return jsonb_build_object('ok', true);
end
$$;
revoke execute on function public.tavolo_join(text) from public;
grant execute on function public.tavolo_join(text) to anon, authenticated;

-- Solo dal SQL Editor di Supabase (il sito non può chiamarla)
create or replace function public.tavolo_set_group_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_code text := lower(trim(coalesce(p_code, '')));
begin
  update public.tavolo_settings
     set group_code_hash = case when v_code = '' then null
                                else extensions.crypt(v_code, extensions.gen_salt('bf')) end
   where id = 1;
  delete from public.tavolo_members;
  return case when v_code = '' then 'Tavolo aperto: chiunque abbia il link può entrare.'
              else 'Codice del gruppo impostato: ogni dispositivo dovrà inserirlo una volta.' end;
end
$$;
revoke execute on function public.tavolo_set_group_code(text) from public, anon, authenticated;

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

-- Senza codice del gruppo chi ha il link del sito può leggere e modificare le
-- campagne; con il codice, solo i dispositivi che l'hanno inserito.
alter table public.tavolo_entities enable row level security;
drop policy if exists tavolo_entities_open on public.tavolo_entities;
drop policy if exists tavolo_entities_members on public.tavolo_entities;
create policy tavolo_entities_members on public.tavolo_entities
  for all to anon, authenticated
  using ((select public.tavolo_is_member()))
  with check ((select public.tavolo_is_member()));
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
  if not public.tavolo_is_member() then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
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
  if not public.tavolo_is_member() then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
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
  if not public.tavolo_is_member() then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
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
  if not public.tavolo_is_member() then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
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
  if not public.tavolo_is_member() then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  select pwd_hash into v_hash from public.tavolo_dm_vault where campaign_id = p_campaign;
  if found and not public.tavolo_pwd_ok(v_hash, p_password) then
    perform pg_sleep(0.4);
    return jsonb_build_object('ok', false, 'reason', 'wrong_password');
  end if;
  delete from public.tavolo_entities where campaign_id = p_campaign;
  delete from public.tavolo_dm_vault where campaign_id = p_campaign;
  if to_regclass('public.tavolo_dm_inbox') is not null then
    execute 'delete from public.tavolo_dm_inbox where campaign_id = $1' using p_campaign;
  end if;
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
-- 3. Messaggi privati per il Master
-- ---------------------------------------------------------------------
-- I giocatori possono solo scrivere; leggere e cancellare richiede la password del Master.
create table if not exists public.tavolo_dm_inbox (
  id          text primary key,
  campaign_id text not null,
  from_name   text,
  from_char   text,
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists tavolo_dm_inbox_campaign_idx on public.tavolo_dm_inbox (campaign_id, created_at);
alter table public.tavolo_dm_inbox enable row level security;
revoke all on public.tavolo_dm_inbox from anon, authenticated;

create or replace function public.tavolo_whisper_dm(p_campaign text, p_id text, p_from_name text, p_from_char text, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tavolo_is_member() then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if coalesce(trim(p_text), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;
  insert into public.tavolo_dm_inbox (id, campaign_id, from_name, from_char, text)
  values (p_id, p_campaign, left(p_from_name, 80), left(p_from_char, 80), left(p_text, 4000))
  on conflict (id) do nothing;
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.tavolo_dm_inbox_list(p_campaign text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  if not public.tavolo_is_member() then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  select pwd_hash into v_hash from public.tavolo_dm_vault where campaign_id = p_campaign;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_vault');
  end if;
  if not public.tavolo_pwd_ok(v_hash, p_password) then
    perform pg_sleep(0.4);
    return jsonb_build_object('ok', false, 'reason', 'wrong_password');
  end if;
  return jsonb_build_object('ok', true, 'items', coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'fromName', from_name, 'fromChar', from_char, 'text', text,
                                        'at', (extract(epoch from created_at) * 1000)::bigint) order by created_at)
      from public.tavolo_dm_inbox where campaign_id = p_campaign), '[]'::jsonb));
end
$$;

create or replace function public.tavolo_dm_inbox_delete(p_campaign text, p_password text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  if not public.tavolo_is_member() then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  select pwd_hash into v_hash from public.tavolo_dm_vault where campaign_id = p_campaign;
  if not found or not public.tavolo_pwd_ok(v_hash, p_password) then
    return jsonb_build_object('ok', false, 'reason', 'wrong_password');
  end if;
  delete from public.tavolo_dm_inbox where campaign_id = p_campaign and id = p_id;
  return jsonb_build_object('ok', true);
end
$$;

revoke execute on function public.tavolo_whisper_dm(text, text, text, text, text) from public;
revoke execute on function public.tavolo_dm_inbox_list(text, text) from public;
revoke execute on function public.tavolo_dm_inbox_delete(text, text, text) from public;
grant execute on function public.tavolo_whisper_dm(text, text, text, text, text) to anon, authenticated;
grant execute on function public.tavolo_dm_inbox_list(text, text) to anon, authenticated;
grant execute on function public.tavolo_dm_inbox_delete(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Migrazione dalla vecchia tabella "campaigns" (se c'è)
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
