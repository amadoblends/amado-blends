-- =========================================================
-- Amado Blends — Migración 2
-- Disponibilidad semanal, configuración de reservas,
-- paquetes de servicios, e imágenes (Storage).
-- Ejecutar en Supabase: SQL editor -> pegar y correr,
-- DESPUÉS de haber corrido schema.sql.
-- =========================================================

-- ---------- AVAILABILITY (horario semanal, 0=domingo .. 6=sábado) ----------
create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  weekday int not null unique check (weekday between 0 and 6),
  is_active boolean not null default false,
  start_time time not null default '09:00',
  end_time time not null default '18:00',
  break_start_time time,
  break_end_time time,
  slot_minutes int not null default 30 check (slot_minutes > 0),
  created_at timestamptz not null default now()
);

insert into availability (weekday, is_active)
select w, false from generate_series(0, 6) as w
where not exists (select 1 from availability);

-- ---------- BOOKING SETTINGS (fila única) ----------
create table if not exists booking_settings (
  id int primary key default 1 check (id = 1),
  booking_window_days int not null default 30,
  min_notice_minutes int not null default 60,
  updated_at timestamptz not null default now()
);
insert into booking_settings (id) values (1) on conflict (id) do nothing;

-- ---------- SERVICES: tipo (single/paquete) + imagen ----------
do $$ begin
  create type service_kind as enum ('single', 'package');
exception when duplicate_object then null; end $$;

alter table services add column if not exists kind service_kind not null default 'single';
alter table services add column if not exists image_url text;

create table if not exists service_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references services(id) on delete cascade,
  item_service_id uuid not null references services(id) on delete restrict,
  unique (package_id, item_service_id)
);

-- ---------- RLS ----------
alter table availability enable row level security;
alter table booking_settings enable row level security;
alter table service_package_items enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['availability','booking_settings','service_package_items']
  loop
    execute format('drop policy if exists "%1$s_admin_all" on %1$s', t);
    execute format(
      'create policy "%1$s_admin_all" on %1$s for all using (is_admin()) with check (is_admin())',
      t
    );
  end loop;
end $$;

drop trigger if exists trg_booking_settings_updated on booking_settings;
create trigger trg_booking_settings_updated before update on booking_settings
  for each row execute function set_updated_at();

-- ---------- STORAGE: bucket público "media" para fotos de productos/servicios ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media_admin_insert" on storage.objects;
create policy "media_admin_insert" on storage.objects
  for insert with check (bucket_id = 'media' and is_admin());

drop policy if exists "media_admin_update" on storage.objects;
create policy "media_admin_update" on storage.objects
  for update using (bucket_id = 'media' and is_admin());

drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete" on storage.objects
  for delete using (bucket_id = 'media' and is_admin());
