-- =====================================================================
--  EcoThreads — Database Schema (Supabase / PostgreSQL)
--  Online thrift store: buy, sell and donate pre-loved clothing
--
--  HOW TO USE
--  1. Supabase dashboard → SQL Editor → New query
--  2. Paste this whole file → Run
--  3. Check: Table Editor (data) and Database → Schema Visualizer (ER diagram)
--
--  NOTE: Running this file again RESETS all EcoThreads tables
--        (drops and recreates them with fresh sample data).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. CLEAN START (safe to re-run)
-- ---------------------------------------------------------------------
drop view if exists public.v_public_orders     cascade;
drop view if exists public.v_impact_stats      cascade;
drop view if exists public.v_items_full        cascade;
drop view if exists public.v_seller_ratings    cascade;
drop view if exists public.v_public_profiles   cascade;

drop table if exists public.activity_log       cascade;
drop table if exists public.feedback           cascade;
drop table if exists public.reviews            cascade;
drop table if exists public.donation_requests  cascade;
drop table if exists public.order_items        cascade;
drop table if exists public.orders             cascade;
drop table if exists public.cart_items         cascade;
drop table if exists public.wishlists          cascade;
drop table if exists public.item_images        cascade;
drop table if exists public.items              cascade;
drop table if exists public.profiles           cascade;
drop table if exists public.ngos               cascade;
drop table if exists public.categories         cascade;

drop function if exists public.handle_new_user()              cascade;
drop function if exists public.current_profile_id()           cascade;
drop function if exists public.is_order_buyer(uuid)           cascade;
drop function if exists public.is_order_seller(uuid)          cascade;
drop function if exists public.set_updated_at()               cascade;
drop function if exists public.log_activity()                 cascade;
drop function if exists public.place_order(text, jsonb)       cascade;
drop function if exists public.request_donation(uuid, text)   cascade;
drop function if exists public.get_schema_info()              cascade;
drop function if exists public.get_table_counts()             cascade;

create extension if not exists pgcrypto;


-- =====================================================================
-- 1. TABLES
-- =====================================================================

-- 1.1 Categories ------------------------------------------------------
create table public.categories (
  id           serial primary key,
  slug         text not null unique,          -- 'mens', 'womens', 'kids', 'accessories'
  name         text not null,
  description  text,
  image_url    text,
  sort_order   int  not null default 0
);
comment on table public.categories is 'Clothing categories shown on the homepage';

-- 1.2 Partner NGOs (for donations) ------------------------------------
create table public.ngos (
  id             serial primary key,
  name           text not null unique,
  city           text not null,
  description    text,
  contact_email  text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
comment on table public.ngos is 'Partner NGOs that receive donated clothing';

-- 1.3 Profiles (one per user) -----------------------------------------
--  auth_id links to Supabase Auth. Demo sellers in the sample data
--  have auth_id = NULL (they are not real login accounts).
create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  phone       text,
  city        text,
  avatar_url  text,
  bio         text,
  created_at  timestamptz not null default now()
);
comment on table public.profiles is 'Buyers and sellers. Passwords live in Supabase Auth, never here';

-- 1.4 Items (listings) ------------------------------------------------
create table public.items (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.profiles(id) on delete cascade,
  category_id   int  not null references public.categories(id),
  title         text not null check (char_length(title) between 3 and 120),
  description   text,
  brand         text,
  size          text,
  color         text,
  condition     text not null check (condition in ('New','Like New','Excellent','Good','Fair')),
  listing_type  text not null check (listing_type in ('sell','donate')),
  price         numeric(10,2) not null default 0,
  ngo_id        int references public.ngos(id),          -- only for donations
  weight_kg     numeric(5,2) not null default 0.5,      -- used for impact estimate
  status        text not null default 'active'
                check (status in ('active','reserved','sold','donated','removed')),
  views         int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Sell → price must be > 0 ; Donate → price must be 0
  constraint price_matches_type check (
       (listing_type = 'sell'   and price > 0)
    or (listing_type = 'donate' and price = 0)
  ),
  -- NGO can only be chosen for donations
  constraint ngo_only_for_donation check (ngo_id is null or listing_type = 'donate')
);
comment on table public.items is 'Clothes listed for sale or donation';
create index items_category_idx on public.items(category_id);
create index items_seller_idx   on public.items(seller_id);
create index items_status_idx   on public.items(status);

-- 1.5 Item images -----------------------------------------------------
create table public.item_images (
  id        serial primary key,
  item_id   uuid not null references public.items(id) on delete cascade,
  url       text not null,
  alt_text  text,                                -- for screen readers
  position  int  not null default 0,
  unique (item_id, position)
);
comment on table public.item_images is 'Up to 5 photos per item';

-- 1.6 Wishlists -------------------------------------------------------
create table public.wishlists (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  item_id     uuid not null references public.items(id)    on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, item_id)
);

-- 1.7 Cart ------------------------------------------------------------
create table public.cart_items (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  item_id     uuid not null references public.items(id)    on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (profile_id, item_id)
);

-- 1.8 Orders ----------------------------------------------------------
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique
                  default ('ET-' || to_char(now(),'YYMMDD') || '-' || upper(substr(md5(random()::text),1,5))),
  buyer_id        uuid not null references public.profiles(id),
  status          text not null default 'placed'
                  check (status in ('placed','shipped','delivered','cancelled')),
  subtotal        numeric(10,2) not null check (subtotal >= 0),
  shipping_fee    numeric(10,2) not null default 0 check (shipping_fee >= 0),
  total           numeric(10,2) generated always as (subtotal + shipping_fee) stored,
  payment_method  text not null check (payment_method in ('upi','card','netbanking','wallet','cod')),
  payment_status  text not null default 'pending'
                  check (payment_status in ('pending','paid','failed','refunded')),
  shipping_name   text not null,
  shipping_phone  text not null,
  address_line    text not null,
  city            text not null,
  state           text not null,
  pincode         text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  created_at      timestamptz not null default now()
);
comment on table public.orders is 'Checkout orders (payment is simulated — no card data is stored)';
create index orders_buyer_idx on public.orders(buyer_id);

-- 1.9 Order items -----------------------------------------------------
create table public.order_items (
  id                 serial primary key,
  order_id           uuid not null references public.orders(id) on delete cascade,
  item_id            uuid not null references public.items(id),
  seller_id          uuid not null references public.profiles(id),
  price_at_purchase  numeric(10,2) not null check (price_at_purchase >= 0),
  unique (order_id, item_id)
);

-- 1.10 Donation requests (someone asks for a free item) ---------------
create table public.donation_requests (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.items(id) on delete cascade,
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  message       text,
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','completed')),
  created_at    timestamptz not null default now(),
  unique (item_id, requester_id)
);

-- 1.11 Reviews (buyer → seller) ---------------------------------------
create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  reviewer_id    uuid not null references public.profiles(id) on delete cascade,
  seller_id      uuid not null references public.profiles(id) on delete cascade,
  item_id        uuid references public.items(id)  on delete set null,
  order_id       uuid references public.orders(id) on delete set null,
  rating         int  not null check (rating between 1 and 5),
  comment        text check (char_length(comment) <= 1000),
  helpful_count  int  not null default 0,
  created_at     timestamptz not null default now(),
  constraint no_self_review check (reviewer_id <> seller_id),
  unique (reviewer_id, item_id)
);
create index reviews_seller_idx on public.reviews(seller_id);

-- 1.12 Usability feedback (in-app "How was this?" widget) -------------
create table public.feedback (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references public.profiles(id) on delete set null,  -- null = anonymous
  page          text not null,                        -- e.g. 'checkout', 'sell-form'
  task          text,                                 -- what the user was trying to do
  ease_rating   int  not null check (ease_rating between 1 and 5),
  satisfaction  int  check (satisfaction between 1 and 5),
  comment       text check (char_length(comment) <= 1000),
  device        text check (device in ('mobile','tablet','desktop')),
  created_at    timestamptz not null default now()
);
comment on table public.feedback is 'User feedback collected inside the app for usability evaluation';

-- 1.13 Activity log (powers the live "what changed" feed) -------------
create table public.activity_log (
  id          bigserial primary key,
  table_name  text not null,
  action      text not null check (action in ('INSERT','UPDATE','DELETE','SYSTEM')),
  record_id   text,
  summary     text not null,
  created_at  timestamptz not null default now()
);
comment on table public.activity_log is 'Auto-filled by triggers. Contains no personal data';


-- =====================================================================
-- 2. HELPER FUNCTIONS & TRIGGERS
-- =====================================================================

-- 2.1 Logged-in user's profile id
create function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_id = auth.uid()
$$;

-- 2.1b Order access helpers (avoid policy loops between orders and order_items)
create function public.is_order_buyer(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders o where o.id = p_order_id and o.buyer_id = public.current_profile_id())
$$;

create function public.is_order_seller(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.order_items oi where oi.order_id = p_order_id and oi.seller_id = public.current_profile_id())
$$;

-- 2.2 Auto-create a profile when someone signs up
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (auth_id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email
  )
  on conflict (email) do update set auth_id = excluded.auth_id;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2.3 Keep items.updated_at fresh
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- 2.4 Write a short, privacy-safe line into activity_log on every change
create function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j   jsonb;      -- the changed row as JSON (works for every table)
  o   jsonb;      -- old row (for updates)
  msg text;
begin
  -- skip while loading sample data
  if coalesce(current_setting('ecothreads.seeding', true), 'off') = 'on' then
    return null;
  end if;

  if tg_op = 'DELETE' then j := to_jsonb(old); else j := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then o := to_jsonb(old); end if;

  if tg_table_name = 'items' then
    if tg_op = 'INSERT' then
      if j->>'listing_type' = 'donate' then
        msg := 'New donation listed: ' || (j->>'title');
      else
        msg := 'New item listed: ' || (j->>'title') || ' (₹' || trim(to_char((j->>'price')::numeric, 'FM99,99,999')) || ')';
      end if;
    elsif tg_op = 'UPDATE' then
      if (o->>'status') is distinct from (j->>'status') then
        msg := 'Item "' || (j->>'title') || '" is now ' || (j->>'status');
      else
        msg := 'Item "' || (j->>'title') || '" was edited';
      end if;
    else
      msg := 'Item "' || (j->>'title') || '" was deleted';
    end if;

  elsif tg_table_name = 'orders' then
    if tg_op = 'INSERT' then
      msg := 'Order ' || (j->>'order_number') || ' placed · ₹' || trim(to_char((j->>'total')::numeric, 'FM99,99,999'));
    elsif tg_op = 'UPDATE' then
      msg := 'Order ' || (j->>'order_number') || ' → ' || (j->>'status');
    else
      msg := 'Order ' || (j->>'order_number') || ' removed';
    end if;

  elsif tg_table_name = 'reviews' then
    msg := case when tg_op = 'INSERT' then 'New ' || (j->>'rating') || '★ review posted'
                else 'A review was ' || lower(tg_op) || 'd' end;

  elsif tg_table_name = 'donation_requests' then
    msg := case when tg_op = 'INSERT' then 'Someone requested a donated item'
                else 'Donation request → ' || (j->>'status') end;

  elsif tg_table_name = 'feedback' then
    msg := 'New usability feedback on "' || (j->>'page') || '" (' || (j->>'ease_rating') || '/5)';

  elsif tg_table_name = 'profiles' then
    msg := case when tg_op = 'INSERT' then 'New member joined from ' || coalesce(j->>'city', 'India')
                else 'A profile was ' || lower(tg_op) || 'd' end;

  elsif tg_table_name = 'wishlists' then
    msg := case when tg_op = 'INSERT' then 'An item was added to a wishlist'
                else 'An item was removed from a wishlist' end;

  elsif tg_table_name = 'cart_items' then
    msg := case when tg_op = 'INSERT' then 'An item was added to a cart'
                else 'An item was removed from a cart' end;

  else
    msg := tg_table_name || ' ' || lower(tg_op);
  end if;

  insert into public.activity_log (table_name, action, record_id, summary)
  values (tg_table_name, tg_op, j->>'id', msg);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['items','orders','reviews','donation_requests','feedback','profiles','wishlists','cart_items']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.log_activity()', t || '_activity', t);
  end loop;
end $$;


-- =====================================================================
-- 3. BUSINESS LOGIC (called from the website)
-- =====================================================================

-- 3.1 Checkout: turns the cart into an order in ONE safe step.
--     Blocks: empty cart, own items, items already sold.
create function public.place_order(p_payment_method text, p_shipping jsonb)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  me        uuid := public.current_profile_id();
  v_sub     numeric(10,2);
  v_ship    numeric(10,2);
  v_order   public.orders;
  bad_title text;
begin
  if me is null then
    raise exception 'Please sign in to place an order';
  end if;

  if not exists (select 1 from cart_items where profile_id = me) then
    raise exception 'Your cart is empty';
  end if;

  select i.title into bad_title
  from cart_items c join items i on i.id = c.item_id
  where c.profile_id = me and (i.status <> 'active' or i.listing_type <> 'sell')
  limit 1;
  if bad_title is not null then
    raise exception '"%" is no longer available. Please remove it from your cart.', bad_title;
  end if;

  if exists (select 1 from cart_items c join items i on i.id = c.item_id
             where c.profile_id = me and i.seller_id = me) then
    raise exception 'You cannot buy your own item';
  end if;

  select sum(i.price) into v_sub
  from cart_items c join items i on i.id = c.item_id
  where c.profile_id = me;

  v_ship := case when v_sub >= 999 then 0 else 49 end;   -- free shipping above ₹999

  insert into orders (buyer_id, subtotal, shipping_fee, payment_method, payment_status,
                      shipping_name, shipping_phone, address_line, city, state, pincode)
  values (me, v_sub, v_ship, p_payment_method,
          case when p_payment_method = 'cod' then 'pending' else 'paid' end,
          p_shipping->>'name', p_shipping->>'phone', p_shipping->>'address',
          p_shipping->>'city', p_shipping->>'state', p_shipping->>'pincode')
  returning * into v_order;

  insert into order_items (order_id, item_id, seller_id, price_at_purchase)
  select v_order.id, i.id, i.seller_id, i.price
  from cart_items c join items i on i.id = c.item_id
  where c.profile_id = me;

  update items set status = 'sold'
  where id in (select item_id from cart_items where profile_id = me);

  delete from cart_items where profile_id = me;

  return v_order;
end $$;

-- 3.2 Request a free (donated) item
create function public.request_donation(p_item_id uuid, p_message text)
returns public.donation_requests
language plpgsql security definer set search_path = public as $$
declare
  me    uuid := public.current_profile_id();
  it    public.items;
  req   public.donation_requests;
begin
  if me is null then raise exception 'Please sign in to request an item'; end if;
  select * into it from items where id = p_item_id;
  if it.id is null or it.listing_type <> 'donate' then raise exception 'This item is not a donation'; end if;
  if it.status <> 'active' then raise exception 'This item has already been given away'; end if;
  if it.seller_id = me then raise exception 'You cannot request your own donation'; end if;

  insert into donation_requests (item_id, requester_id, message)
  values (p_item_id, me, p_message)
  returning * into req;
  return req;
end $$;

-- 3.3 Schema info for the live ER diagram page (/database)
create function public.get_schema_info()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'tables', (
      select jsonb_agg(jsonb_build_object(
        'name', t.table_name,
        'comment', obj_description(('public.' || quote_ident(t.table_name))::regclass, 'pg_class'),
        'columns', (
          select jsonb_agg(jsonb_build_object(
            'name', c.column_name,
            'type', c.data_type,
            'nullable', c.is_nullable = 'YES',
            'is_pk', exists (
              select 1 from information_schema.table_constraints tc
              join information_schema.key_column_usage k
                on k.constraint_name = tc.constraint_name and k.table_schema = tc.table_schema
              where tc.table_schema = 'public' and tc.table_name = t.table_name
                and tc.constraint_type = 'PRIMARY KEY' and k.column_name = c.column_name)
          ) order by c.ordinal_position)
          from information_schema.columns c
          where c.table_schema = 'public' and c.table_name = t.table_name)
      ) order by t.table_name)
      from information_schema.tables t
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE'),
    'relations', (
      select jsonb_agg(jsonb_build_object(
        'from_table',  cl.relname,
        'from_column', a.attname,
        'to_table',    fcl.relname,
        'to_column',   fa.attname))
      from pg_constraint con
      join pg_class cl      on cl.oid  = con.conrelid
      join pg_namespace n   on n.oid   = cl.relnamespace
      join pg_class fcl     on fcl.oid = con.confrelid
      join pg_namespace fn  on fn.oid  = fcl.relnamespace
      join lateral unnest(con.conkey)  with ordinality as ck(attnum, ord) on true
      join lateral unnest(con.confkey) with ordinality as fk(attnum, ord) on fk.ord = ck.ord
      join pg_attribute a   on a.attrelid  = cl.oid  and a.attnum  = ck.attnum
      join pg_attribute fa  on fa.attrelid = fcl.oid and fa.attnum = fk.attnum
      where con.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public')
  )
$$;

-- 3.4 Row counts for every table (live counters)
create function public.get_table_counts()
returns table (table_name text, row_count bigint)
language plpgsql stable security definer set search_path = public as $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' order by c.relname
  loop
    table_name := t;
    execute format('select count(*) from public.%I', t) into row_count;
    return next;
  end loop;
end $$;


-- =====================================================================
-- 4. VIEWS (safe, read-friendly data for the website & live viewer)
-- =====================================================================

-- Public profile card — email masked, no phone
create view public.v_public_profiles as
select
  id,
  full_name,
  left(email, 2) || '***@' || split_part(email, '@', 2) as email_masked,
  city,
  avatar_url,
  created_at
from public.profiles;

-- Seller rating summary
create view public.v_seller_ratings as
select
  p.id                                   as seller_id,
  p.full_name                            as seller_name,
  count(r.id)                            as review_count,
  coalesce(round(avg(r.rating), 1), 0)   as avg_rating
from public.profiles p
left join public.reviews r on r.seller_id = p.id
group by p.id, p.full_name;

-- Everything the shop grid needs in one row
create view public.v_items_full as
select
  i.*,
  c.slug        as category_slug,
  c.name        as category_name,
  p.full_name   as seller_name,
  p.city        as seller_city,
  sr.avg_rating as seller_rating,
  sr.review_count as seller_review_count,
  n.name        as ngo_name,
  (select url from public.item_images im where im.item_id = i.id order by position limit 1) as cover_image,
  coalesce((select array_agg(url order by position) from public.item_images im where im.item_id = i.id), '{}') as images
from public.items i
join public.categories c       on c.id = i.category_id
join public.profiles p         on p.id = i.seller_id
join public.v_seller_ratings sr on sr.seller_id = i.seller_id
left join public.ngos n        on n.id = i.ngo_id
where i.status <> 'removed';

-- Sustainability impact (approximate, per kg of clothing re-used)
--   ~15 kg CO₂ and ~10,000 L water saved per kg (commonly cited estimates)
create view public.v_impact_stats as
select
  count(*) filter (where status in ('sold','donated'))                         as items_rehomed,
  count(*) filter (where listing_type = 'donate')                              as items_donated,
  coalesce(sum(weight_kg) filter (where status in ('sold','donated')), 0)      as kg_saved,
  round(coalesce(sum(weight_kg) filter (where status in ('sold','donated')), 0) * 15, 1)    as co2_saved_kg,
  round(coalesce(sum(weight_kg) filter (where status in ('sold','donated')), 0) * 10000, 0) as water_saved_litres,
  count(*) filter (where status = 'active')                                    as items_available
from public.items;

-- Orders without personal details (for the public live viewer)
create view public.v_public_orders as
select order_number, status, payment_method, payment_status, total, city, created_at,
       (select count(*) from public.order_items oi where oi.order_id = o.id) as item_count
from public.orders o;


-- =====================================================================
-- 5. ROW LEVEL SECURITY (who can read / write what)
-- =====================================================================
alter table public.categories        enable row level security;
alter table public.ngos              enable row level security;
alter table public.profiles          enable row level security;
alter table public.items             enable row level security;
alter table public.item_images       enable row level security;
alter table public.wishlists         enable row level security;
alter table public.cart_items        enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.donation_requests enable row level security;
alter table public.reviews           enable row level security;
alter table public.feedback          enable row level security;
alter table public.activity_log      enable row level security;

-- Public reference data
create policy "Anyone can view categories" on public.categories for select using (true);
create policy "Anyone can view NGOs"       on public.ngos       for select using (true);

-- Profiles: you see and edit only your own row (others use v_public_profiles)
create policy "Read own profile"   on public.profiles for select using (auth_id = auth.uid());
create policy "Update own profile" on public.profiles for update using (auth_id = auth.uid());

-- Items
create policy "Anyone can view listed items" on public.items
  for select using (status <> 'removed' or seller_id = public.current_profile_id());
create policy "Sellers add their own items" on public.items
  for insert with check (seller_id = public.current_profile_id());
create policy "Sellers edit their own items" on public.items
  for update using (seller_id = public.current_profile_id());
create policy "Sellers delete their own items" on public.items
  for delete using (seller_id = public.current_profile_id());

-- Item images
create policy "Anyone can view images" on public.item_images for select using (true);
create policy "Sellers manage images of their items" on public.item_images
  for all using (exists (select 1 from public.items i where i.id = item_id and i.seller_id = public.current_profile_id()))
  with check   (exists (select 1 from public.items i where i.id = item_id and i.seller_id = public.current_profile_id()));

-- Wishlist & cart: private to the owner
create policy "Own wishlist" on public.wishlists
  for all using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
create policy "Own cart" on public.cart_items
  for all using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());

-- Orders: buyers see their orders; sellers see orders containing their items
create policy "Buyer sees own orders" on public.orders
  for select using (buyer_id = public.current_profile_id());
create policy "Seller sees orders for their items" on public.orders
  for select using (public.is_order_seller(id));
create policy "Buyer can cancel own order" on public.orders
  for update using (buyer_id = public.current_profile_id());

create policy "Buyer or seller sees order lines" on public.order_items
  for select using (
    seller_id = public.current_profile_id() or public.is_order_buyer(order_id));

-- Donation requests: requester and item owner
create policy "Requester or donor sees request" on public.donation_requests
  for select using (
    requester_id = public.current_profile_id()
    or exists (select 1 from public.items i where i.id = item_id and i.seller_id = public.current_profile_id()));
create policy "Donor updates request status" on public.donation_requests
  for update using (exists (select 1 from public.items i where i.id = item_id and i.seller_id = public.current_profile_id()));

-- Reviews: public to read, write only as yourself
create policy "Anyone can read reviews" on public.reviews for select using (true);
create policy "Write own reviews"  on public.reviews for insert with check (reviewer_id = public.current_profile_id());
create policy "Edit own reviews"   on public.reviews for update using (reviewer_id = public.current_profile_id());
create policy "Delete own reviews" on public.reviews for delete using (reviewer_id = public.current_profile_id());

-- Feedback: anyone (even signed-out visitors) can send; everyone can read
create policy "Anyone can send feedback" on public.feedback
  for insert with check (profile_id is null or profile_id = public.current_profile_id());
create policy "Anyone can read feedback" on public.feedback for select using (true);

-- Activity log: read-only for everyone (written only by triggers)
create policy "Anyone can read activity" on public.activity_log for select using (true);

-- Permissions for views & functions
grant select on public.v_public_profiles, public.v_seller_ratings, public.v_items_full,
                public.v_impact_stats, public.v_public_orders
  to anon, authenticated;
grant execute on function public.get_schema_info(), public.get_table_counts() to anon, authenticated;
grant execute on function public.place_order(text, jsonb), public.request_donation(uuid, text),
                          public.current_profile_id()
  to authenticated;
revoke execute on function public.place_order(text, jsonb), public.request_donation(uuid, text) from public, anon;


-- =====================================================================
-- 6. REALTIME (live updates on the /database page and the shop)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['activity_log','items','reviews','feedback']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;


-- =====================================================================
-- 7. PHOTO STORAGE (bucket: item-images)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can view item images"       on storage.objects;
drop policy if exists "Signed-in users upload item images" on storage.objects;
drop policy if exists "Users delete own item images"       on storage.objects;

create policy "Public can view item images" on storage.objects
  for select using (bucket_id = 'item-images');
-- each user uploads into their own folder: item-images/<auth uid>/<file>
create policy "Signed-in users upload item images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own item images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);


-- =====================================================================
-- 8. SAMPLE DATA
-- =====================================================================
select set_config('ecothreads.seeding', 'on', false);

insert into public.categories (slug, name, description, image_url, sort_order) values
('mens',        'Men''s Fashion',   'Shirts, jackets, denims and more',         'https://images.unsplash.com/photo-1638408201374-ff177f17e7a5?w=1080&q=80', 1),
('womens',      'Women''s Fashion', 'Dresses, kurtas, sarees and tops',         'https://images.unsplash.com/photo-1604182459406-fefa32508ab0?w=1080&q=80', 2),
('kids',        'Kids'' Clothing',  'Outgrown-too-soon clothes for little ones','https://images.unsplash.com/photo-1601925240970-98447486fcdb?w=1080&q=80', 3),
('accessories', 'Accessories',      'Bags, belts, scarves and footwear',        'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1080&q=80', 4);

insert into public.ngos (name, city, description, contact_email) values
('Helping Hands Foundation', 'Mumbai',    'Distributes clothing to shelters and night schools',     'hello@helpinghands.example.org'),
('Care For All',             'Pune',      'Supports families in rural Maharashtra',                 'contact@careforall.example.org'),
('Cloth Bridge Initiative',  'Delhi',     'Repairs and redistributes garments to those in need',    'team@clothbridge.example.org'),
('Local Collection Drive',   'Bengaluru', 'Neighbourhood drop-off points and doorstep pickup',      'drive@localcollection.example.org');

-- Demo members (not real login accounts)
insert into public.profiles (id, full_name, email, phone, city, bio) values
('11111111-1111-1111-1111-111111111111', 'Riya Sharma',   'riya.sharma@example.com',   '9800000001', 'Mumbai',    'Clearing my wardrobe one jacket at a time.'),
('22222222-2222-2222-2222-222222222222', 'Kabir Mehta',   'kabir.mehta@example.com',   '9800000002', 'Pune',      'Vintage denim collector.'),
('33333333-3333-3333-3333-333333333333', 'Ananya Iyer',   'ananya.iyer@example.com',   '9800000003', 'Bengaluru', 'Mom of two — kids outgrow everything!'),
('44444444-4444-4444-4444-444444444444', 'Arjun Nair',    'arjun.nair@example.com',    '9800000004', 'Delhi',     'Minimalist. Buy less, choose well.'),
('55555555-5555-5555-5555-555555555555', 'Sneha Kulkarni','sneha.kulkarni@example.com','9800000005', 'Mumbai',    'Ethnic wear lover.');

-- Items
insert into public.items (id, seller_id, category_id, title, description, brand, size, color, condition, listing_type, price, ngo_id, weight_kg, status, views, created_at) values
('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',1,'Vintage Denim Jacket','Classic 90s washed denim, all buttons intact.','Levi''s','L','Blue','Excellent','sell',1200,null,0.9,'active',134, now()-interval '2 days'),
('a0000000-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444',1,'Linen Casual Shirt','Breathable linen, perfect for Mumbai summers.','FabIndia','M','White','Like New','sell',650,null,0.3,'active',88, now()-interval '3 days'),
('a0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222',1,'Slim Fit Chinos','Worn twice. No fading.','Uniqlo','32','Beige','Like New','sell',800,null,0.5,'sold',61, now()-interval '9 days'),
('a0000000-0000-0000-0000-000000000004','44444444-4444-4444-4444-444444444444',1,'Wool Blend Sweater','Warm and soft, ideal for Delhi winters.',null,'L','Grey','Good','donate',0,3,0.7,'active',40, now()-interval '1 day'),
('a0000000-0000-0000-0000-000000000005','55555555-5555-5555-5555-555555555555',2,'Floral Maxi Dress','Flowy cotton maxi with floral print.','Global Desi','S','Pink','Excellent','sell',950,null,0.4,'active',152, now()-interval '1 day'),
('a0000000-0000-0000-0000-000000000006','55555555-5555-5555-5555-555555555555',2,'Handloom Cotton Saree','Pure cotton handloom with zari border.',null,'Free','Maroon','Like New','sell',2200,null,0.8,'active',97, now()-interval '4 days'),
('a0000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111',2,'Embroidered Kurta','Chikankari work, worn once for a wedding.','Biba','M','Mint','Like New','sell',1100,null,0.4,'sold',73, now()-interval '12 days'),
('a0000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111',2,'Everyday Denim Jeans','High-rise, straight fit.','Zara','28','Blue','Good','sell',700,null,0.6,'active',45, now()-interval '6 days'),
('a0000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111',2,'Cotton Summer Tops (set of 3)','Light tops for daily wear.',null,'M','Mixed','Good','donate',0,1,0.5,'active',29, now()-interval '5 hours'),
('a0000000-0000-0000-0000-000000000010','33333333-3333-3333-3333-333333333333',3,'Kids Winter Jacket','Padded jacket, fits 6–7 years.','H&M','6-7Y','Red','Excellent','sell',600,null,0.6,'active',58, now()-interval '2 days'),
('a0000000-0000-0000-0000-000000000011','33333333-3333-3333-3333-333333333333',3,'Baby Rompers (pack of 4)','Soft cotton rompers, 6–12 months.','Mothercare','6-12M','Assorted','Good','donate',0,2,0.4,'active',33, now()-interval '3 days'),
('a0000000-0000-0000-0000-000000000012','33333333-3333-3333-3333-333333333333',3,'School Uniform Set','Two shirts and one pair of trousers.',null,'8Y','White/Navy','Fair','donate',0,4,0.7,'donated',21, now()-interval '15 days'),
('a0000000-0000-0000-0000-000000000013','22222222-2222-2222-2222-222222222222',4,'Canvas Backpack','Water-resistant, laptop sleeve fits 15".','Wildcraft','One size','Olive','Excellent','sell',850,null,0.8,'active',112, now()-interval '2 days'),
('a0000000-0000-0000-0000-000000000014','55555555-5555-5555-5555-555555555555',4,'Leather Tote Bag','Genuine leather, minor wear on handles.',null,'One size','Tan','Good','sell',1500,null,0.9,'active',66, now()-interval '7 days'),
('a0000000-0000-0000-0000-000000000015','44444444-4444-4444-4444-444444444444',4,'White Sneakers','Cleaned and deodorised. Size UK 9.','Puma','UK 9','White','Good','sell',900,null,0.8,'active',90, now()-interval '8 hours'),
('a0000000-0000-0000-0000-000000000016','11111111-1111-1111-1111-111111111111',4,'Silk Scarf','Hand-painted silk scarf.',null,'One size','Teal','Like New','sell',450,null,0.1,'active',18, now()-interval '10 days');

insert into public.item_images (item_id, url, alt_text, position) values
('a0000000-0000-0000-0000-000000000001','https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80','Blue vintage denim jacket',0),
('a0000000-0000-0000-0000-000000000002','https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=80','White linen shirt',0),
('a0000000-0000-0000-0000-000000000003','https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&q=80','Beige chinos',0),
('a0000000-0000-0000-0000-000000000004','https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&q=80','Grey knit sweater',0),
('a0000000-0000-0000-0000-000000000005','https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&q=80','Pink floral maxi dress',0),
('a0000000-0000-0000-0000-000000000006','https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80','Maroon handloom saree',0),
('a0000000-0000-0000-0000-000000000007','https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800&q=80','Mint embroidered kurta',0),
('a0000000-0000-0000-0000-000000000008','https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80','Blue denim jeans',0),
('a0000000-0000-0000-0000-000000000009','https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80','Cotton summer tops',0),
('a0000000-0000-0000-0000-000000000010','https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=800&q=80','Red kids winter jacket',0),
('a0000000-0000-0000-0000-000000000011','https://images.unsplash.com/photo-1522771930-78848d9293e8?w=800&q=80','Baby rompers',0),
('a0000000-0000-0000-0000-000000000012','https://images.unsplash.com/photo-1604671801908-6f0c6a092c05?w=800&q=80','School uniform set',0),
('a0000000-0000-0000-0000-000000000013','https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80','Olive canvas backpack',0),
('a0000000-0000-0000-0000-000000000014','https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80','Tan leather tote bag',0),
('a0000000-0000-0000-0000-000000000015','https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80','White sneakers',0),
('a0000000-0000-0000-0000-000000000016','https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800&q=80','Teal silk scarf',0);

-- Past orders (for sold items)
insert into public.orders (id, order_number, buyer_id, status, subtotal, shipping_fee, payment_method, payment_status,
                           shipping_name, shipping_phone, address_line, city, state, pincode, created_at) values
('b0000000-0000-0000-0000-000000000001','ET-DEMO-0001','11111111-1111-1111-1111-111111111111','delivered',800,49,'upi','paid',
 'Riya Sharma','9800000001','12 Palm Grove, Andheri West','Mumbai','Maharashtra','400053', now()-interval '8 days'),
('b0000000-0000-0000-0000-000000000002','ET-DEMO-0002','33333333-3333-3333-3333-333333333333','shipped',1100,0,'card','paid',
 'Ananya Iyer','9800000003','45 Lake View Road, Indiranagar','Bengaluru','Karnataka','560038', now()-interval '10 days');

insert into public.order_items (order_id, item_id, seller_id, price_at_purchase) values
('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222',800),
('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111',1100);

insert into public.donation_requests (item_id, requester_id, message, status) values
('a0000000-0000-0000-0000-000000000012','55555555-5555-5555-5555-555555555555','For my neighbour''s son starting school.','completed'),
('a0000000-0000-0000-0000-000000000004','33333333-3333-3333-3333-333333333333','Would help a lot this winter, thank you!','pending');

insert into public.reviews (reviewer_id, seller_id, item_id, order_id, rating, comment, helpful_count, created_at) values
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000001',5,
 'Exactly as described and packed with care. Fast delivery!',12, now()-interval '6 days'),
('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000007','b0000000-0000-0000-0000-000000000002',4,
 'Beautiful kurta. One small loose thread but otherwise perfect.',5, now()-interval '7 days'),
('55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333','a0000000-0000-0000-0000-000000000012',null,5,
 'Very kind donor, uniform was clean and neatly folded.',8, now()-interval '12 days');

insert into public.wishlists (profile_id, item_id) values
('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001'),
('44444444-4444-4444-4444-444444444444','a0000000-0000-0000-0000-000000000005'),
('33333333-3333-3333-3333-333333333333','a0000000-0000-0000-0000-000000000013');

insert into public.cart_items (profile_id, item_id) values
('44444444-4444-4444-4444-444444444444','a0000000-0000-0000-0000-000000000006');

insert into public.feedback (page, task, ease_rating, satisfaction, comment, device) values
('sell-form', 'List an item for sale',      4, 4, 'Photo preview is helpful. Would like a size guide.', 'mobile'),
('checkout',  'Buy an item using UPI',      5, 5, 'Progress steps made it clear where I was.',          'desktop'),
('browse',    'Find a jacket under ₹1000',  3, 4, 'Price filter took a moment to find.',                'mobile');

select set_config('ecothreads.seeding', 'off', false);

insert into public.activity_log (table_name, action, summary)
values ('system', 'SYSTEM', 'Database initialised with sample data 🌱');


-- =====================================================================
-- DONE ✅
--  Tables: categories, ngos, profiles, items, item_images, wishlists,
--          cart_items, orders, order_items, donation_requests, reviews,
--          feedback, activity_log
--  Views:  v_items_full, v_public_profiles, v_seller_ratings,
--          v_impact_stats, v_public_orders
-- =====================================================================
