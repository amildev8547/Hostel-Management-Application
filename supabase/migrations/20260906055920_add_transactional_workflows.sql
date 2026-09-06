-- Atomic owner review. This remains SECURITY INVOKER so the caller's RLS
-- ownership rules apply throughout the transaction.
create or replace function public.review_admission_application(
  p_application_id uuid,
  p_status text,
  p_room_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  app_row public.admission_applications%rowtype;
  booking_row public.bookings%rowtype;
  room_row public.rooms%rowtype;
  selected_room_id uuid;
  tenant_row public.tenants%rowtype;
  used_beds integer;
begin
  if not private.is_hostel_admin() or caller_email = '' then
    raise exception 'Administrator access required';
  end if;
  if p_status not in ('APPROVED', 'REJECTED') then
    raise exception 'Status must be APPROVED or REJECTED';
  end if;

  select * into app_row
  from public.admission_applications
  where id = p_application_id and lower(owner_email) = caller_email
  for update;
  if not found then raise exception 'Application not found'; end if;
  if app_row.status <> 'PENDING' then raise exception 'This application has already been processed'; end if;

  select * into booking_row
  from public.bookings
  where admission_application_id = app_row.id and lower(owner_email) = caller_email
  for update;

  if p_status = 'REJECTED' then
    update public.admission_applications set status = 'REJECTED', updated_at = now() where id = app_row.id;
    if booking_row.id is not null then delete from public.bookings where id = booking_row.id; end if;
    insert into public.notifications(title, message, type, application_id, branch_id, owner_email)
    values ('Admission Rejected', 'Application for ' || app_row.name || ' was rejected.', 'ADMISSION_APPROVED', app_row.id, app_row.branch_id, caller_email);
    return jsonb_build_object('message', 'Application rejected.');
  end if;

  selected_room_id := coalesce(booking_row.room_id, p_room_id);
  if selected_room_id is null then raise exception 'Room selection is required for approval'; end if;
  perform pg_advisory_xact_lock(hashtextextended(selected_room_id::text, 0));
  select * into room_row from public.rooms
  where id = selected_room_id and branch_id = app_row.branch_id and lower(owner_email) = caller_email
  for update;
  if not found then raise exception 'Selected room was not found in this branch'; end if;

  select count(*) into used_beds from public.tenants
  where room_id = selected_room_id and status = 'ACTIVE' and lower(owner_email) = caller_email;
  used_beds := used_beds + (
    select count(*) from public.bookings
    where room_id = selected_room_id and status in ('RESERVED','FORM_SUBMITTED')
      and id is distinct from booking_row.id and lower(owner_email) = caller_email
  );
  if used_beds >= room_row.capacity then raise exception 'Selected room is fully occupied'; end if;

  insert into public.tenants(
    name, phone, whatsapp_number, address, guardian_name, guardian_phone,
    nearest_police_station, occupation, work_location, joining_date, leaving_date,
    status, profile_photo_url, aadhaar_front_url, aadhaar_back_url, room_id, owner_email
  ) values (
    app_row.name, app_row.phone, app_row.whatsapp_number, app_row.address,
    app_row.guardian_name, app_row.guardian_phone, app_row.nearest_police_station,
    app_row.occupation, app_row.work_location, app_row.joining_date, app_row.leaving_date,
    'ACTIVE', app_row.profile_photo_url, app_row.aadhaar_front_url,
    app_row.aadhaar_back_url, selected_room_id, caller_email
  ) returning * into tenant_row;

  update public.documents set tenant_id = tenant_row.id where admission_application_id = app_row.id;
  update public.payments set tenant_id = tenant_row.id where admission_application_id = app_row.id;
  update public.admission_applications set status = 'APPROVED', updated_at = now() where id = app_row.id;
  if booking_row.id is not null then
    update public.bookings set status = 'OCCUPIED', tenant_id = tenant_row.id, updated_at = now() where id = booking_row.id;
  end if;
  update public.rooms set status = case
    when status = 'MAINTENANCE' then status
    when used_beds + 1 >= capacity then 'FULL'
    when used_beds + 1 > 0 then 'PARTIAL'
    else 'AVAILABLE' end, updated_at = now()
  where id = selected_room_id;
  insert into public.notifications(title, message, type, tenant_id, application_id, branch_id, owner_email)
  values ('Admission Approved', 'Application for ' || app_row.name || ' was approved. Tenant has been allocated to Room ' || room_row.room_number || '.', 'ADMISSION_APPROVED', tenant_row.id, app_row.id, app_row.branch_id, caller_email);
  return jsonb_build_object('message', 'Application approved. Tenant active.', 'tenant', to_jsonb(tenant_row));
end;
$$;

revoke all on function public.review_admission_application(uuid,text,uuid) from public, anon;
grant execute on function public.review_admission_application(uuid,text,uuid) to authenticated;

-- One database transaction for the public form's application, documents,
-- payment, notification, and optional booking claim. Only the Edge Function's
-- server-side role can execute it.
create or replace function public.create_public_admission(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  booking_row public.bookings%rowtype;
  branch_row public.branches%rowtype;
  application_row public.admission_applications%rowtype;
  payment_row public.payments%rowtype;
  selected_branch_id uuid;
  selected_owner text;
  fee numeric;
  doc jsonb;
begin
  if coalesce(p_payload->>'booking_token','') <> '' then
    select * into booking_row from public.bookings
    where secure_token = p_payload->>'booking_token' for update;
    if not found or booking_row.status <> 'RESERVED' then
      raise exception 'This booking link is no longer active';
    end if;
    selected_branch_id := booking_row.branch_id;
  else
    selected_branch_id := (p_payload->>'branch_id')::uuid;
  end if;
  select * into branch_row from public.branches where id = selected_branch_id and status = 'ACTIVE';
  if not found then raise exception 'Branch not found'; end if;
  selected_owner := lower(branch_row.owner_email);

  if booking_row.id is not null then
    select admission_fee into fee from public.rooms where id = booking_row.room_id;
  else
    select admission_fee into fee from public.rooms
    where branch_id = selected_branch_id and room_type = p_payload->>'preferred_room_type'
      and status <> 'MAINTENANCE' and lower(owner_email) = selected_owner
    order by admission_fee limit 1;
  end if;
  fee := coalesce(fee, 1500);

  insert into public.admission_applications(
    name, phone, whatsapp_number, address, guardian_name, guardian_phone,
    nearest_police_station, occupation, work_location, joining_date, leaving_date,
    profile_photo_url, aadhaar_front_url, aadhaar_back_url, notes, preferred_room_type,
    status, payment_status, branch_id, owner_email
  ) values (
    coalesce(booking_row.name, p_payload->>'name'), coalesce(booking_row.phone, p_payload->>'phone'),
    p_payload->>'whatsapp_number', p_payload->>'address', p_payload->>'guardian_name',
    p_payload->>'guardian_phone', p_payload->>'nearest_police_station', p_payload->>'occupation',
    p_payload->>'work_location', coalesce(booking_row.expected_joining_date, (p_payload->>'joining_date')::date),
    nullif(p_payload->>'leaving_date','')::date, p_payload->>'profile_photo_path',
    p_payload->>'aadhaar_front_path', p_payload->>'aadhaar_back_path', nullif(p_payload->>'notes',''),
    coalesce((select room_type from public.rooms where id = booking_row.room_id), p_payload->>'preferred_room_type'),
    'PENDING', 'PENDING', selected_branch_id, selected_owner
  ) returning * into application_row;

  for doc in select * from jsonb_array_elements(coalesce(p_payload->'documents','[]'::jsonb)) loop
    insert into public.documents(file_name,file_type,storage_path,bucket,admission_application_id,owner_email)
    values (doc->>'file_name', doc->>'file_type', doc->>'storage_path', 'tenant-documents', application_row.id, selected_owner);
  end loop;
  insert into public.payments(amount,status,payment_type,due_date,payment_method,payment_link_url,admission_application_id,branch_id,owner_email)
  values (fee,'PENDING','ADMISSION',current_date,'UPI',null,application_row.id,selected_branch_id,selected_owner)
  returning * into payment_row;
  if booking_row.id is not null then
    update public.bookings set status='FORM_SUBMITTED', admission_application_id=application_row.id, updated_at=now()
    where id=booking_row.id;
  end if;
  insert into public.notifications(title,message,type,application_id,branch_id,owner_email)
  values ('New Admission Application', application_row.name || ' submitted an admission application for ' || branch_row.name || '.', 'ADMISSION_RECEIVED', application_row.id, selected_branch_id, selected_owner);
  return jsonb_build_object('application_id',application_row.id,'payment_id',payment_row.id,'amount',fee,'owner_email',selected_owner);
end;
$$;

revoke all on function public.create_public_admission(jsonb) from public, anon, authenticated;
grant execute on function public.create_public_admission(jsonb) to service_role;
