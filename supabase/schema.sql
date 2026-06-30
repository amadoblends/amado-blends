-- =========================================================
-- Amado Blends — Esquema inicial (módulo Admin / Barbero)
-- Modelo: un solo administrador (barbero), muchos clientes.
-- Ejecutar en Supabase: SQL editor -> pegar y correr.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
do $$ begin
  create type appointment_status as enum ('confirmada', 'pendiente', 'completada', 'cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_segment as enum ('frecuente', 'nuevo', 'inactivo', 'regular');
exception when duplicate_object then null; end $$;

do $$ begin
  create type note_type as enum ('preferencias', 'productos', 'estilo', 'otros');
exception when duplicate_object then null; end $$;

-- ---------- PROFILES (admin) ----------
-- Solo se permite role = 'admin'. La app es single-tenant: 1 barbero.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'admin' check (role = 'admin'),
  avatar_url text,
  phone text,
  created_at timestamptz not null default now()
);

-- ---------- SERVICES ----------
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes int not null default 30 check (duration_minutes > 0),
  price numeric(10,2) not null default 0 check (price >= 0),
  color text not null default '#FF6A3D',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- CLIENTS ----------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  avatar_url text,
  birth_date date,
  quick_notes text,
  segment client_segment not null default 'nuevo',
  created_at timestamptz not null default now()
);
create index if not exists clients_full_name_idx on clients using gin (to_tsvector('simple', full_name));
create index if not exists clients_phone_idx on clients (phone);

-- ---------- APPOINTMENTS ----------
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid not null references services(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status appointment_status not null default 'pendiente',
  price numeric(10,2) not null default 0 check (price >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists appointments_starts_at_idx on appointments (starts_at);
create index if not exists appointments_client_idx on appointments (client_id);

-- Prevent double-booking: no overlapping appointments (excluding cancelled)
alter table appointments add column if not exists time_range tstzrange
  generated always as (tstzrange(starts_at, ends_at, '[)')) stored;

create extension if not exists "btree_gist";

do $$ begin
  alter table appointments add constraint no_overlapping_appointments
    exclude using gist (time_range with &&)
    where (status <> 'cancelada');
exception when duplicate_object then null; end $$;

-- ---------- PRODUCTS / INVENTORY ----------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  low_stock_threshold int not null default 8,
  critical_stock_threshold int not null default 3,
  units_sold int not null default 0,
  image_url text,
  created_at timestamptz not null default now()
);

-- ---------- CLIENT NOTES ----------
create table if not exists client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  type note_type not null default 'otros',
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists client_notes_client_idx on client_notes (client_id);

-- ---------- CLIENT PREFERENCES ----------
create table if not exists client_preferences (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references clients(id) on delete cascade,
  preferred_style text,
  payment_method text,
  products_used text[],
  updated_at timestamptz not null default now()
);

-- ---------- NOTIFICATIONS ----------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- DASHBOARD LAYOUT (drag & drop persisted order) ----------
create table if not exists dashboard_layout (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id) on delete cascade unique,
  card_order text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- =========================================================
-- ROW LEVEL SECURITY
-- Single-admin model: only an authenticated user whose profile
-- has role = 'admin' may read/write any business data.
-- Public/anon has zero access. No client-facing access yet
-- (client portal is a future phase).
-- =========================================================

alter table profiles enable row level security;
alter table services enable row level security;
alter table clients enable row level security;
alter table appointments enable row level security;
alter table products enable row level security;
alter table client_notes enable row level security;
alter table client_preferences enable row level security;
alter table notifications enable row level security;
alter table dashboard_layout enable row level security;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles: a user can only see/update their own profile, and only if admin role
drop policy if exists "profiles_self_select" on profiles;
create policy "profiles_self_select" on profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_self_update" on profiles;
create policy "profiles_self_update" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- generic admin-only full access policy helper applied per table
do $$
declare
  t text;
begin
  foreach t in array array['services','clients','appointments','products','client_notes','client_preferences','notifications','dashboard_layout']
  loop
    execute format('drop policy if exists "%1$s_admin_all" on %1$s', t);
    execute format(
      'create policy "%1$s_admin_all" on %1$s for all using (is_admin()) with check (is_admin())',
      t
    );
  end loop;
end $$;

-- ---------- updated_at triggers ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_client_preferences_updated on client_preferences;
create trigger trg_client_preferences_updated before update on client_preferences
  for each row execute function set_updated_at();

drop trigger if exists trg_dashboard_layout_updated on dashboard_layout;
create trigger trg_dashboard_layout_updated before update on dashboard_layout
  for each row execute function set_updated_at();

-- ---------- seed: default services ----------
insert into services (name, duration_minutes, price, color)
select * from (values
  ('Corte de cabello', 45, 35, '#FF6A3D'),
  ('Corte + Barba', 60, 50, '#7C5CFF'),
  ('Afeitado', 30, 25, '#2F7BF6'),
  ('Barba + Perfilado', 30, 20, '#1EA672')
) as v(name, duration_minutes, price, color)
where not exists (select 1 from services);
