-- Parallel Supabase migration foundation for HostelHub.
-- This migration does not delete or rewrite existing rows. Production remains on
-- Render/MongoDB until data-copy and parity verification are complete.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.admin_accounts (email)
values ('amildev8547@gmail.com')
on conflict (email) do update set active = true, updated_at = now();

alter table public.admin_accounts enable row level security;
revoke all on public.admin_accounts from anon;
grant select on public.admin_accounts to authenticated;

create or replace function private.is_hostel_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_accounts a
    where a.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      and a.active
  );
$$;

revoke all on function private.is_hostel_admin() from public, anon;
grant execute on function private.is_hostel_admin() to authenticated;

drop policy if exists admin_can_view_own_access on public.admin_accounts;
create policy admin_can_view_own_access on public.admin_accounts
for select to authenticated
using (email = lower(coalesce((select auth.jwt() ->> 'email'), '')) and active);

-- Add non-destructive migration and ownership columns to the existing schema.
alter table public.owner_profile add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.owner_profile add column if not exists legacy_id text unique;
alter table public.branches add column if not exists owner_id uuid references auth.users(id) on delete restrict;
alter table public.branches add column if not exists legacy_id text unique;
alter table public.rooms add column if not exists owner_id uuid references auth.users(id) on delete restrict;
alter table public.rooms add column if not exists legacy_id text unique;
alter table public.admission_applications add column if not exists owner_id uuid references auth.users(id) on delete restrict;
alter table public.admission_applications add column if not exists legacy_id text unique;
alter table public.tenants add column if not exists owner_id uuid references auth.users(id) on delete restrict;
alter table public.tenants add column if not exists legacy_id text unique;
alter table public.payments add column if not exists owner_id uuid references auth.users(id) on delete restrict;
alter table public.payments add column if not exists legacy_id text unique;
alter table public.documents add column if not exists owner_id uuid references auth.users(id) on delete restrict;
alter table public.documents add column if not exists legacy_id text unique;
alter table public.notifications add column if not exists owner_id uuid references auth.users(id) on delete restrict;
alter table public.notifications add column if not exists legacy_id text unique;
alter table public.notifications add column if not exists tenant_id uuid references public.tenants(id) on delete set null;
alter table public.notifications add column if not exists application_id uuid references public.admission_applications(id) on delete set null;
alter table public.notifications add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.settings add column if not exists owner_id uuid references auth.users(id) on delete restrict;
alter table public.settings add column if not exists legacy_id text unique;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null check (char_length(trim(name)) >= 2),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  bed_number integer not null check (bed_number > 0),
  expected_joining_date date not null,
  notes text,
  status text not null default 'RESERVED' check (status in ('RESERVED', 'FORM_SUBMITTED', 'OCCUPIED')),
  secure_token text not null unique,
  owner_id uuid references auth.users(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  admission_application_id uuid unique references public.admission_applications(id) on delete set null,
  tenant_id uuid unique references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, bed_number)
);

alter table public.bookings enable row level security;

-- Remove the earlier unrestricted policies before exposing production data.
do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array['owner_profile','branches','rooms','admission_applications','tenants','payments','documents','notifications','settings','bookings']
  loop
    for policy_name in select policyname from pg_policies where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    end loop;
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format(
      'create policy admin_full_access on public.%I for all to authenticated using ((select private.is_hostel_admin())) with check ((select private.is_hostel_admin()))',
      table_name
    );
  end loop;
end $$;

-- Recreate the admin account self-view after the generic policy cleanup above.
drop policy if exists admin_full_access on public.admin_accounts;
drop policy if exists admin_can_view_own_access on public.admin_accounts;
create policy admin_can_view_own_access on public.admin_accounts
for select to authenticated
using (email = lower(coalesce((select auth.jwt() ->> 'email'), '')) and active);

-- Files are private. Public admission uploads are performed by the validated Edge
-- Function with the service role; signed URLs are returned for admin viewing.
update storage.buckets set public = false where id = 'tenant-documents';
drop policy if exists public_delete_tenant_documents on storage.objects;
drop policy if exists public_read_tenant_documents on storage.objects;
drop policy if exists public_update_tenant_documents on storage.objects;
drop policy if exists public_upload_tenant_documents on storage.objects;
drop policy if exists admin_manage_tenant_documents on storage.objects;
create policy admin_manage_tenant_documents on storage.objects
for all to authenticated
using (bucket_id = 'tenant-documents' and (select private.is_hostel_admin()))
with check (bucket_id = 'tenant-documents' and (select private.is_hostel_admin()));

create index if not exists bookings_owner_status_idx on public.bookings(owner_id, status);
create index if not exists bookings_branch_idx on public.bookings(branch_id);
create index if not exists bookings_room_idx on public.bookings(room_id);
create index if not exists notifications_owner_read_idx on public.notifications(owner_id, is_read, created_at desc);
