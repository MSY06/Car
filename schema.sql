-- BOURSA / Supabase schema
-- Run this entire file in Supabase Dashboard > SQL Editor > New query.
-- Uses Supabase Auth for administrators. Never put service_role key in browser code.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 2 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 160),
  price numeric(14,2) not null check (price > 0),
  year integer not null check (year between 1950 and 2099),
  km integer not null default 0 check (km >= 0),
  fuel text not null default 'ديزل' check (fuel in ('ديزل','بنزين','هجين','كهربائي')),
  city text not null default 'نواكشوط' check (city in ('نواكشوط','نواذيبو','الزويرات','روصو','كيفه','أخرى')),
  category_id uuid references public.categories(id) on delete restrict,
  inspection_status text not null default 'pending' check (inspection_status in ('done','pending')),
  description text check (description is null or char_length(description) <= 3000),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  car_id uuid references public.cars(id) on delete set null,
  car_title text,
  name text not null check (char_length(trim(name)) between 2 and 100),
  phone text not null check (char_length(trim(phone)) between 7 and 24),
  status text not null default 'new' check (status in ('new','contacted','sold')),
  created_at timestamptz not null default now()
);

create index if not exists cars_active_created_idx on public.cars(is_active, created_at desc);
create index if not exists cars_category_idx on public.cars(category_id);
create index if not exists cars_city_idx on public.cars(city);
create index if not exists leads_created_idx on public.leads(created_at desc);
create index if not exists leads_status_idx on public.leads(status);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists cars_updated_at on public.cars;
create trigger cars_updated_at before update on public.cars
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.cars enable row level security;
alter table public.leads enable row level security;

-- Helper checks membership without exposing admin table to anonymous users.
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public, auth
as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admins can read admin list" on public.admin_users;
create policy "admins can read admin list" on public.admin_users
for select to authenticated using (public.is_admin());

drop policy if exists "public read active categories" on public.categories;
create policy "public read active categories" on public.categories
for select to anon, authenticated using (is_active = true or public.is_admin());
drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read active cars" on public.cars;
create policy "public read active cars" on public.cars
for select to anon, authenticated using (is_active = true or public.is_admin());
drop policy if exists "admins manage cars" on public.cars;
create policy "admins manage cars" on public.cars
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public create leads" on public.leads;
create policy "public create leads" on public.leads
for insert to anon, authenticated
with check (
  status = 'new'
  and char_length(trim(name)) between 2 and 100
  and char_length(trim(phone)) between 7 and 24
);
drop policy if exists "admins read leads" on public.leads;
create policy "admins read leads" on public.leads
for select to authenticated using (public.is_admin());
drop policy if exists "admins update leads" on public.leads;
create policy "admins update leads" on public.leads
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete leads" on public.leads;
create policy "admins delete leads" on public.leads
for delete to authenticated using (public.is_admin());

-- Storage: public read of car photos; only administrators can upload/update/delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('car-images','car-images',true,12582912,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=12582912,
allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "public read car images" on storage.objects;
create policy "public read car images" on storage.objects
for select to anon, authenticated using (bucket_id = 'car-images');
drop policy if exists "admins upload car images" on storage.objects;
create policy "admins upload car images" on storage.objects
for insert to authenticated with check (bucket_id = 'car-images' and public.is_admin());
drop policy if exists "admins update car images" on storage.objects;
create policy "admins update car images" on storage.objects
for update to authenticated using (bucket_id = 'car-images' and public.is_admin())
with check (bucket_id = 'car-images' and public.is_admin());
drop policy if exists "admins delete car images" on storage.objects;
create policy "admins delete car images" on storage.objects
for delete to authenticated using (bucket_id = 'car-images' and public.is_admin());

-- Optional starter categories (safe to run repeatedly).
insert into public.categories(name) values
('سيارات عائلية'),('سيارات رباعية الدفع'),('سيارات اقتصادية'),('شاحنات')
on conflict (name) do nothing;

-- ADMIN SETUP:
-- 1) Create the administrator account in Supabase Dashboard > Authentication > Users > Add user.
-- 2) Copy that user's UUID.
-- 3) Run the following separately after replacing the UUID:
-- insert into public.admin_users(user_id) values ('PASTE-AUTH-USER-UUID-HERE');
