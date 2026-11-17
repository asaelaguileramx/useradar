-- Sprint 06 (part 2): intent column, structured intake, reps linked to Supabase Auth,
-- secure submission and tracking functions, and row level security on every public table.

create extension if not exists pgcrypto;

-- 2. Inquiry columns. Leads without a vehicle have no auction source, lot or email.
alter table public.inquiry
  add column if not exists intent text,
  add column if not exists reference text,
  add column if not exists intake jsonb not null default '{}'::jsonb,
  add column if not exists preferred_language text not null default 'es',
  add column if not exists customer_notes text,
  add column if not exists lead_source text,
  add column if not exists landing_path text,
  add column if not exists contacted_at timestamptz;

alter table public.inquiry alter column flow drop not null;
alter table public.inquiry alter column source drop not null;
alter table public.inquiry alter column contact_email drop not null;

-- Backfill legacy rows from their flow without touching their original data.
update public.inquiry set intent = case flow when 'FLOW_A' then 'existing_lot' when 'FLOW_B' then 'vehicle_search' end
 where intent is null;
update public.inquiry set reference = 'RAD-' || upper(substr(replace(id::text, '-', ''), 1, 6)) where reference is null;

alter table public.inquiry alter column intent set not null;
alter table public.inquiry alter column reference set not null;

do $$ begin
  alter table public.inquiry add constraint inquiry_intent_check check (intent in ('existing_lot','vehicle_search','wholesale_inquiry'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.inquiry add constraint inquiry_reference_key unique (reference);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.inquiry add constraint inquiry_language_check check (preferred_language in ('es','en'));
exception when duplicate_object then null; end $$;
-- Only existing-lot leads must identify a vehicle.
do $$ begin
  alter table public.inquiry add constraint inquiry_lot_required check (
    intent <> 'existing_lot' or lot_number is not null or vehicle_url is not null);
exception when duplicate_object then null; end $$;
-- The two new lead types use a limited qualification lifecycle.
do $$ begin
  alter table public.inquiry add constraint inquiry_new_types_status check (
    intent = 'existing_lot' or status::text in ('NEW','CONTACTED','QUALIFIED','DISQUALIFIED','CLOSED'));
exception when duplicate_object then null; end $$;

create index if not exists inquiry_intent_created_idx on public.inquiry (intent, created_at desc);
create index if not exists inquiry_phone_created_idx on public.inquiry (contact_phone, created_at desc);

-- intent and submitted answers are immutable after creation
create or replace function public.inquiry_guard() returns trigger language plpgsql as $$
begin
  if new.intent is distinct from old.intent then raise exception 'intent is immutable'; end if;
  if new.reference is distinct from old.reference or new.tracking_token is distinct from old.tracking_token
     or new.intake is distinct from old.intake or new.created_at is distinct from old.created_at then
    raise exception 'submitted data is immutable';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists inquiry_guard on public.inquiry;
create trigger inquiry_guard before update on public.inquiry for each row execute function public.inquiry_guard();

-- 3. Reps sign in with Supabase Auth; link the existing "user" table to auth.users.
alter table public."user" add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create or replace function public.current_rep_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public."user" where auth_user_id = auth.uid() and role in ('REP','ADMIN') limit 1;
$$;
create or replace function public.is_rep() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_rep_id() is not null;
$$;

-- 4. Row level security on every public table. Customers never read tables directly;
-- they submit and track through the functions below. Reps read through policies.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format('revoke all on public.%I from anon', r.tablename);
    execute format('drop policy if exists rep_read on public.%I', r.tablename);
    execute format('create policy rep_read on public.%I for select to authenticated using (public.is_rep())', r.tablename);
  end loop;
end $$;

-- Money input: "$5,000" → 5000; anything that is not a plain positive amount → null
create or replace function public.parse_money(v text) returns numeric language sql immutable as $$
  select case when regexp_replace(coalesce(v,''), '[\s,$]', '', 'g') ~ '^[0-9]+(\.[0-9]{1,2})?$'
              then regexp_replace(v, '[\s,$]', '', 'g')::numeric end;
$$;

-- 5. Public submission: validates every field, throttles by phone, ignores bots,
-- writes the inquiry, its first history row and acknowledgements in one transaction.
create or replace function public.submit_inquiry(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_intent text := p->>'intent';
  v_phone text := regexp_replace(coalesce(p->>'phone',''), '\D', '', 'g');
  v_name text := btrim(coalesce(p->>'name',''));
  v_email text := nullif(btrim(coalesce(p->>'email','')), '');
  v_lang text := coalesce(p->>'language','es');
  v_notes text := nullif(btrim(coalesce(p->>'notes','')), '');
  v_intake jsonb; v_flow flow; v_source auction_source; v_use intended_use;
  v_lot text; v_url text; v_offer numeric; v_budget numeric;
  v_ref text; v_id uuid; v_token uuid; v_recent int;
begin
  if coalesce(p->>'website','') <> '' then raise exception 'rejected'; end if;
  if v_intent is null or v_intent not in ('existing_lot','vehicle_search','wholesale_inquiry') then raise exception 'invalid:intent'; end if;
  if char_length(v_phone) = 10 then v_phone := '1' || v_phone; end if;
  if v_phone !~ '^[0-9]{11,15}$' then raise exception 'invalid:phone'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'invalid:name'; end if;
  if v_email is not null and (char_length(v_email) > 200 or v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$') then raise exception 'invalid:email'; end if;
  if v_lang not in ('es','en') then raise exception 'invalid:language'; end if;
  if v_notes is not null and char_length(v_notes) > 2000 then raise exception 'invalid:notes'; end if;

  select count(*) into v_recent from public.inquiry where contact_phone = v_phone and created_at > now() - interval '10 minutes';
  if v_recent >= 3 then raise exception 'rate_limited'; end if;

  if v_intent = 'existing_lot' then
    v_url := nullif(left(btrim(coalesce(p->>'lot','')), 300), '');
    v_lot := substring(coalesce(v_url,'') from '([0-9]{6,10})');
    v_offer := public.parse_money(p->>'maxOffer');
    if v_lot is null then raise exception 'invalid:lot'; end if;
    if coalesce(p->>'auction','') not in ('copart','iaa') then raise exception 'invalid:auction'; end if;
    if v_offer is null or v_offer <= 0 or v_offer > 500000 then raise exception 'invalid:maxOffer'; end if;
    if coalesce(p->>'title','') not in ('salvage','clean') then raise exception 'invalid:title'; end if;
    if coalesce(p->>'destination','') not in ('us','mx') then raise exception 'invalid:destination'; end if;
    if coalesce((p->>'acknowledged')::boolean, false) is not true then raise exception 'invalid:acknowledged'; end if;
    v_flow := 'FLOW_A';
    v_source := case p->>'auction' when 'iaa' then 'IAAI'::auction_source else 'COPART'::auction_source end;
    v_intake := jsonb_build_object('title', p->>'title', 'destination', p->>'destination',
      'transport', public.parse_money(p->>'transport'),
      'estimate', case when jsonb_typeof(p->'estimate') = 'object' then p->'estimate' else null end);
  elsif v_intent = 'vehicle_search' then
    v_budget := public.parse_money(p->>'budget');
    if char_length(btrim(coalesce(p->>'vehicle',''))) < 1 then raise exception 'invalid:vehicle'; end if;
    if v_budget is null or v_budget <= 0 or v_budget > 500000 then raise exception 'invalid:budget'; end if;
    if char_length(btrim(coalesce(p->>'location',''))) < 2 then raise exception 'invalid:location'; end if;
    if coalesce(p->>'use','') not in ('personal','resale','other') then raise exception 'invalid:use'; end if;
    v_flow := 'FLOW_B';
    v_use := case p->>'use' when 'personal' then 'PERSONAL_USE' when 'resale' then 'RESALE' else 'OTHER' end;
    v_intake := jsonb_build_object('vehicle', left(btrim(p->>'vehicle'), 200), 'budget_usd', v_budget,
      'location', left(btrim(p->>'location'), 120), 'use', p->>'use');
  else
    v_budget := public.parse_money(p->>'budget');
    if coalesce(p->>'use','') not in ('personal','resale','business_inventory') then raise exception 'invalid:use'; end if;
    if coalesce(p->>'buyerType','') not in ('individual','licensed_dealer','other_business') then raise exception 'invalid:buyerType'; end if;
    if coalesce(p->>'license','') not in ('yes','no','not_applicable') then raise exception 'invalid:license'; end if;
    if v_budget is null or v_budget <= 0 or v_budget > 1000000 then raise exception 'invalid:budget'; end if;
    if char_length(btrim(coalesce(p->>'location',''))) < 2 then raise exception 'invalid:location'; end if;
    if coalesce(p->>'experience','') not in ('first_time','occasional','frequent') then raise exception 'invalid:experience'; end if;
    if coalesce((p->>'disclosureAck')::boolean, false) is not true then raise exception 'invalid:disclosureAck'; end if;
    v_flow := null;
    v_use := case p->>'use' when 'personal' then 'PERSONAL_USE' when 'resale' then 'RESALE' else 'DEALERSHIP_INVENTORY' end;
    v_intake := jsonb_build_object('use', p->>'use', 'buyer_type', p->>'buyerType', 'dealer_license', p->>'license',
      'budget_usd', v_budget, 'category', nullif(left(btrim(coalesce(p->>'category','')), 200), ''),
      'location', left(btrim(p->>'location'), 120), 'experience', p->>'experience');
  end if;

  loop
    v_ref := 'RAD-' || upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=0OIl1', ''), 1, 6));
    exit when char_length(v_ref) = 10 and not exists (select 1 from public.inquiry where reference = v_ref);
  end loop;

  insert into public.inquiry (flow, source, status, contact_name, contact_email, contact_phone, lot_number, vehicle_url,
      max_bid_cents, intended_use, final_destination, export_required, intent, reference, intake, preferred_language,
      customer_notes, lead_source, landing_path)
  values (v_flow, v_source, 'NEW', v_name, v_email, v_phone, v_lot, v_url,
      case when v_offer is not null then round(v_offer * 100)::int end, v_use,
      case when v_intent = 'existing_lot' then p->>'destination' end,
      coalesce(v_intent = 'existing_lot' and p->>'destination' = 'mx', false),
      v_intent, v_ref, v_intake, v_lang, v_notes,
      left(nullif(p->>'source',''), 60), left(nullif(p->>'landingPath',''), 120))
  returning id, tracking_token into v_id, v_token;

  insert into public.inquiry_status_history (inquiry_id, from_status, to_status, note) values (v_id, null, 'NEW', 'submitted');

  if v_intent = 'existing_lot' then
    insert into public.inquiry_acknowledgement (inquiry_id, type, version)
    select v_id, t, '2026-11' from unnest(array['AUCTION_RISK','MAXIMUM_BID','ADDITIONAL_COSTS','ACCURACY']::acknowledgement_type[]) t;
  elsif v_intent = 'wholesale_inquiry' then
    insert into public.inquiry_acknowledgement (inquiry_id, type, version) values (v_id, 'WHOLESALE_ELIGIBILITY', '2026-11');
  end if;

  return jsonb_build_object('reference', v_ref, 'token', v_token, 'intent', v_intent);
end $$;

-- 6. Public tracking by the private tracking token (existing concept).
create or replace function public.track_inquiry(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'reference', i.reference, 'intent', i.intent, 'status', i.status, 'created_at', i.created_at,
    'history', coalesce((select jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.changed_at) order by h.changed_at)
                         from public.inquiry_status_history h where h.inquiry_id = i.id), '[]'::jsonb))
  from public.inquiry i where i.tracking_token = p_token;
$$;

-- 7. Rep actions, each recorded in the existing history and audit tables.
create or replace function public.rep_set_inquiry_status(p_inquiry uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_rep uuid := public.current_rep_id(); v_old inquiry_status; v_intent text;
begin
  if v_rep is null then raise exception 'forbidden'; end if;
  select status, intent into v_old, v_intent from public.inquiry where id = p_inquiry for update;
  if v_intent is null then raise exception 'not_found'; end if;
  if v_old::text = p_status then raise exception 'no_change'; end if;
  if v_old::text = 'CLOSED' then raise exception 'closed'; end if;
  if v_intent <> 'existing_lot' and p_status not in ('NEW','CONTACTED','QUALIFIED','DISQUALIFIED','CLOSED') then
    raise exception 'invalid:status';
  end if;
  update public.inquiry set status = p_status::inquiry_status,
      contacted_at = case when p_status = 'CONTACTED' and contacted_at is null then now() else contacted_at end,
      qualified_by_id = case when p_status = 'QUALIFIED' then v_rep else qualified_by_id end,
      qualified_at = case when p_status = 'QUALIFIED' then now() else qualified_at end
   where id = p_inquiry;
  insert into public.inquiry_status_history (inquiry_id, from_status, to_status, changed_by, note)
  values (p_inquiry, v_old, p_status::inquiry_status, v_rep, nullif(btrim(coalesce(p_note,'')), ''));
  insert into public.audit_log (entity_type, entity_id, actor_id, action, before_json, after_json)
  values ('inquiry', p_inquiry, v_rep, 'status_changed', jsonb_build_object('status', v_old), jsonb_build_object('status', p_status));
  return jsonb_build_object('status', p_status);
end $$;

create or replace function public.rep_add_inquiry_note(p_inquiry uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare v_rep uuid := public.current_rep_id();
begin
  if v_rep is null then raise exception 'forbidden'; end if;
  if char_length(btrim(coalesce(p_body,''))) = 0 then raise exception 'invalid:note'; end if;
  insert into public.inquiry_note (inquiry_id, author_id, body) values (p_inquiry, v_rep, left(btrim(p_body), 2000));
end $$;

revoke all on function public.submit_inquiry(jsonb) from public;
revoke all on function public.track_inquiry(uuid) from public;
revoke all on function public.rep_set_inquiry_status(uuid, text, text) from public;
revoke all on function public.rep_add_inquiry_note(uuid, text) from public;
grant execute on function public.submit_inquiry(jsonb) to anon, authenticated;
grant execute on function public.track_inquiry(uuid) to anon, authenticated;
grant execute on function public.rep_set_inquiry_status(uuid, text, text) to authenticated;
grant execute on function public.rep_add_inquiry_note(uuid, text) to authenticated;
grant execute on function public.is_rep() to authenticated;

-- pgcrypto lives in the extensions schema on Supabase
alter function public.submit_inquiry(jsonb) set search_path = public, extensions;
revoke all on function public.current_rep_id() from public;
grant execute on function public.current_rep_id() to authenticated;
