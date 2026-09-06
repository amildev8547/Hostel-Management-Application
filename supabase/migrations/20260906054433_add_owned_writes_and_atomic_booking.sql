create or replace function private.set_row_owner_email()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.owner_email is null or trim(new.owner_email) = '' then
    new.owner_email := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  end if;
  if new.owner_email = '' then raise exception 'Owner email is required'; end if;
  return new;
end;
$$;

revoke all on function private.set_row_owner_email() from public, anon;

do $$
declare table_name text;
begin
  foreach table_name in array array['owner_profile','branches','rooms','admission_applications','tenants','payments','documents','notifications','settings','bookings']
  loop
    execute format('drop trigger if exists set_owner_email on public.%I', table_name);
    execute format('create trigger set_owner_email before insert on public.%I for each row execute function private.set_row_owner_email()', table_name);
  end loop;
end $$;

create or replace function public.reserve_available_bed(
  p_name text,
  p_phone text,
  p_branch_id uuid,
  p_room_id uuid,
  p_expected_joining_date date,
  p_notes text default null
)
returns public.bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_room public.rooms;
  active_tenants integer;
  selected_bed integer;
  created_booking public.bookings;
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
begin
  if not private.is_hostel_admin() then raise exception 'Administrator access required'; end if;
  if trim(p_name) = '' or p_phone !~ '^[0-9]{10}$' then raise exception 'Valid name and phone are required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));
  select * into selected_room from public.rooms
    where id = p_room_id and branch_id = p_branch_id and lower(owner_email) = caller_email;
  if not found then raise exception 'Room not found in this branch'; end if;
  if selected_room.status = 'MAINTENANCE' then raise exception 'This room is not currently usable'; end if;

  select count(*) into active_tenants from public.tenants where room_id = p_room_id and status = 'ACTIVE';
  select bed into selected_bed
  from generate_series(1, selected_room.capacity) bed
  where bed > active_tenants
    and not exists (select 1 from public.bookings b where b.room_id = p_room_id and b.bed_number = bed)
  order by bed limit 1;
  if selected_bed is null then raise exception 'This room has no available beds'; end if;

  insert into public.bookings(name, phone, bed_number, expected_joining_date, notes, secure_token, owner_email, branch_id, room_id)
  values(trim(p_name), p_phone, selected_bed, p_expected_joining_date, nullif(trim(p_notes), ''), encode(gen_random_bytes(32), 'hex'), caller_email, p_branch_id, p_room_id)
  returning * into created_booking;
  return created_booking;
end;
$$;

revoke all on function public.reserve_available_bed(text,text,uuid,uuid,date,text) from public, anon;
grant execute on function public.reserve_available_bed(text,text,uuid,uuid,date,text) to authenticated;
