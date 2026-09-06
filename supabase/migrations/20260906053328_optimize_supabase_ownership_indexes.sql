drop policy if exists admin_can_view_own_access on public.admin_accounts;
create policy admin_can_view_own_access on public.admin_accounts
for select to authenticated
using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')) and active);

create index if not exists owner_profile_owner_idx on public.owner_profile(owner_id);
create index if not exists branches_owner_idx on public.branches(owner_id);
create index if not exists rooms_owner_idx on public.rooms(owner_id);
create index if not exists admissions_owner_idx on public.admission_applications(owner_id);
create index if not exists tenants_owner_idx on public.tenants(owner_id);
create index if not exists payments_owner_idx on public.payments(owner_id);
create index if not exists documents_owner_idx on public.documents(owner_id);
create index if not exists settings_owner_idx on public.settings(owner_id);
create index if not exists notifications_tenant_idx on public.notifications(tenant_id);
create index if not exists notifications_application_idx on public.notifications(application_id);
create index if not exists notifications_branch_idx on public.notifications(branch_id);
