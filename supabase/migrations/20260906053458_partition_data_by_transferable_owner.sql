do $$
declare
  table_name text;
begin
  foreach table_name in array array['owner_profile','branches','rooms','admission_applications','tenants','payments','documents','notifications','settings','bookings']
  loop
    execute format('alter table public.%I add column if not exists owner_email text', table_name);
    execute format('create index if not exists %I on public.%I(owner_email)', table_name || '_owner_email_idx', table_name);
    execute format('drop policy if exists admin_full_access on public.%I', table_name);
    execute format(
      'create policy admin_owns_rows on public.%I for all to authenticated using ((select private.is_hostel_admin()) and lower(owner_email) = lower(coalesce((select auth.jwt()) ->> ''email'', ''''))) with check ((select private.is_hostel_admin()) and lower(owner_email) = lower(coalesce((select auth.jwt()) ->> ''email'', '''')))',
      table_name
    );
  end loop;
end $$;

-- Transfer helper: the current administrator can assign all owned rows to the
-- next approved email in one transaction after that email is added to
-- admin_accounts. It is intentionally kept in the private schema.
create or replace function private.transfer_hostel_owner(new_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  normalized_new_email text := lower(trim(new_email));
  table_name text;
begin
  if not private.is_hostel_admin() then
    raise exception 'Administrator access required';
  end if;
  if normalized_new_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'A valid client email is required';
  end if;

  insert into public.admin_accounts(email, active)
  values (normalized_new_email, true)
  on conflict (email) do update set active = true, updated_at = now();

  foreach table_name in array array['owner_profile','branches','rooms','admission_applications','tenants','payments','documents','notifications','settings','bookings']
  loop
    execute format('update public.%I set owner_email = $1 where lower(owner_email) = $2', table_name)
      using normalized_new_email, current_email;
  end loop;

  update public.admin_accounts set active = false, updated_at = now() where email = current_email;
end;
$$;

revoke all on function private.transfer_hostel_owner(text) from public, anon;
grant execute on function private.transfer_hostel_owner(text) to authenticated;
