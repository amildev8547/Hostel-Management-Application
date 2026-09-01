import { createClient } from '@supabase/supabase-js';

declare const process: {
  env?: Record<string, string | undefined>;
};

const SUPABASE_URL =
  process.env?.EXPO_PUBLIC_SUPABASE_URL || 'https://mraiwlzhvsvwesbzwqgo.supabase.co';
const SUPABASE_ANON_KEY = process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const SUPABASE_STORAGE_BUCKET = 'tenant-documents';

if (!SUPABASE_ANON_KEY) {
  console.warn('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY. Add it before running the app.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type ApiResponse<T = any> = { data: T };
type RequestConfig = { params?: Record<string, any> };

function apiError(message: string) {
  const error: any = new Error(message);
  error.response = { data: { error: message } };
  return error;
}

function requireSupabaseKey() {
  if (!SUPABASE_ANON_KEY) {
    throw apiError('Supabase anon key is missing. Add EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env.');
  }
}

function camel(row: any): any {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map(camel);
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      camel(value),
    ])
  );
}

function snakePayload(payload: any) {
  const map: Record<string, string> = {
    roomNumber: 'room_number',
    roomType: 'room_type',
    monthlyRent: 'monthly_rent',
    admissionFee: 'admission_fee',
    branchId: 'branch_id',
    newRoomId: 'new_room_id',
    whatsappNumber: 'whatsapp_number',
    guardianName: 'guardian_name',
    guardianPhone: 'guardian_phone',
    nearestPoliceStation: 'nearest_police_station',
    workLocation: 'work_location',
    joiningDate: 'joining_date',
    leavingDate: 'leaving_date',
    preferredRoomType: 'preferred_room_type',
    profilePhotoUrl: 'profile_photo_url',
    aadhaarFrontUrl: 'aadhaar_front_url',
    aadhaarBackUrl: 'aadhaar_back_url',
    paymentStatus: 'payment_status',
    paymentId: 'payment_id',
    paymentType: 'payment_type',
    daysBilled: 'days_billed',
    originalAmount: 'original_amount',
    discountAmount: 'discount_amount',
    dueDate: 'due_date',
    paidDate: 'paid_date',
    paymentMethod: 'payment_method',
    transactionId: 'transaction_id',
    paymentLinkUrl: 'payment_link_url',
    receiptUrl: 'receipt_url',
    tenantId: 'tenant_id',
    admissionApplicationId: 'admission_application_id',
  };

  return Object.fromEntries(
    Object.entries(payload || {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [map[key] || key, value])
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function startOfNextMonth(year: number, month: number) {
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return startOfMonth(next.year, next.month);
}

function computeRoomStatus(room: any, occupiedCount: number) {
  if (room.status === 'MAINTENANCE') return 'MAINTENANCE';
  if (occupiedCount <= 0) return 'AVAILABLE';
  if (occupiedCount >= Number(room.capacity)) return 'FULL';
  return 'PARTIAL';
}

async function updateRoomOccupancy(roomId: string) {
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, capacity, status')
    .eq('id', roomId)
    .single();
  if (roomError || !room) return;

  const { count } = await supabase
    .from('tenants')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('status', 'ACTIVE');

  const status = computeRoomStatus(room, count || 0);
  await supabase.from('rooms').update({ status }).eq('id', roomId);
}

async function getSettingsObject() {
  const { data, error } = await supabase.from('settings').select('*');
  if (error) throw apiError(error.message);
  return Object.fromEntries((data || []).map((item: any) => [item.key, item.value]));
}

function buildUpiUrl(settings: Record<string, string>, amount: number, note: string) {
  const upiId = settings.payment_upi_id?.trim();
  if (!upiId) return '';
  const receiver = settings.payment_receiver_name?.trim() || 'HostelHub';
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(receiver)}&am=${encodeURIComponent(
    String(amount)
  )}&cu=INR&tn=${encodeURIComponent(note)}`;
}

async function getBranches(params: Record<string, any> = {}) {
  let query = supabase.from('branches').select('*, rooms(*, tenants(id,status)), payments(amount,status)');
  if (params.search) query = query.ilike('name', `%${params.search}%`);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw apiError(error.message);

  return (data || []).map((branch: any) => {
    const rooms = branch.rooms || [];
    const totalRooms = rooms.length;
    const totalBeds = rooms.reduce((sum: number, room: any) => sum + Number(room.capacity || 0), 0);
    const occupiedBeds = rooms.reduce(
      (sum: number, room: any) => sum + (room.tenants || []).filter((t: any) => t.status === 'ACTIVE').length,
      0
    );
    return {
      ...camel(branch),
      totalRooms,
      occupiedBeds,
      vacantBeds: Math.max(0, totalBeds - occupiedBeds),
      occupancyPercentage: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      pendingPayments: (branch.payments || [])
        .filter((payment: any) => payment.status !== 'PAID')
        .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0),
    };
  });
}

async function getRooms(params: Record<string, any> = {}) {
  let query = supabase.from('rooms').select('*, branch:branches(*), tenants(*)');
  if (params.branchId) query = query.eq('branch_id', params.branchId);
  const { data, error } = await query.order('room_number');
  if (error) throw apiError(error.message);
  return (data || []).map((room: any) => {
    const activeTenants = (room.tenants || []).filter((tenant: any) => tenant.status === 'ACTIVE');
    return { ...camel(room), occupied: activeTenants.length, tenants: camel(activeTenants) };
  });
}

async function getRoom(id: string) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, branch:branches(*), tenants(*)')
    .eq('id', id)
    .single();
  if (error) throw apiError(error.message);
  const activeTenants = (data.tenants || []).filter((tenant: any) => tenant.status === 'ACTIVE');
  const tenantIds = activeTenants.map((tenant: any) => tenant.id);
  const paymentHistory =
    tenantIds.length > 0
      ? await supabase
          .from('payments')
          .select('*')
          .in('tenant_id', tenantIds)
          .order('due_date', { ascending: false })
      : { data: [], error: null };
  if (paymentHistory.error) throw apiError(paymentHistory.error.message);
  return {
    ...camel(data),
    occupied: activeTenants.length,
    tenants: camel(activeTenants),
    paymentHistory: camel(paymentHistory.data || []),
  };
}

async function getBranchDashboard(id: string) {
  const { data: branch, error } = await supabase
    .from('branches')
    .select('*, rooms(*, tenants(id,status)), payments(*)')
    .eq('id', id)
    .single();
  if (error) throw apiError(error.message);

  const rooms = branch.rooms || [];
  const totalBeds = rooms.reduce((sum: number, room: any) => sum + Number(room.capacity || 0), 0);
  const occupiedBeds = rooms.reduce(
    (sum: number, room: any) => sum + (room.tenants || []).filter((t: any) => t.status === 'ACTIVE').length,
    0
  );
  const payments = branch.payments || [];

  return {
    branch: camel(branch),
    metrics: {
      totalRooms: rooms.length,
      vacantRooms: rooms.filter((room: any) => computeRoomStatus(room, (room.tenants || []).length) === 'AVAILABLE').length,
      partialRooms: rooms.filter((room: any) => computeRoomStatus(room, (room.tenants || []).length) === 'PARTIAL').length,
      occupiedRooms: rooms.filter((room: any) => computeRoomStatus(room, (room.tenants || []).length) === 'FULL').length,
      totalBeds,
      occupiedBeds,
      vacantBeds: Math.max(0, totalBeds - occupiedBeds),
      occupancyPercentage: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      thisMonthPaid: payments.filter((p: any) => p.status === 'PAID').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
      pendingPayments: payments.filter((p: any) => p.status === 'PENDING').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
      overduePayments: payments.filter((p: any) => p.status === 'OVERDUE').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
    },
  };
}

async function getDashboard() {
  const [branches, rooms, tenants, payments, admissions] = await Promise.all([
    supabase.from('branches').select('*'),
    supabase.from('rooms').select('*, tenants(id,status)'),
    supabase.from('tenants').select('*').eq('status', 'ACTIVE'),
    supabase.from('payments').select('*, tenant:tenants(*), branch:branches(*)').order('created_at', { ascending: false }),
    supabase.from('admission_applications').select('*, branch:branches(*)').order('created_at', { ascending: false }),
  ]);
  for (const result of [branches, rooms, tenants, payments, admissions]) {
    if (result.error) throw apiError(result.error.message);
  }

  const paymentRows = payments.data || [];
  return {
    totalBranches: branches.data?.length || 0,
    totalRooms: rooms.data?.length || 0,
    totalTenants: tenants.data?.length || 0,
    vacantBeds: (rooms.data || []).reduce(
      (sum: number, room: any) => sum + Math.max(0, Number(room.capacity || 0) - (room.tenants || []).length),
      0
    ),
    monthlyCollection: paymentRows.filter((p: any) => p.status === 'PAID').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
    pendingCollection: paymentRows.filter((p: any) => p.status === 'PENDING').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
    overdueCollection: paymentRows.filter((p: any) => p.status === 'OVERDUE').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
    pendingAdmissions: (admissions.data || []).filter((a: any) => a.status === 'PENDING').length,
    recentAdmissions: camel((admissions.data || []).slice(0, 5)),
    recentPayments: camel(paymentRows.filter((p: any) => p.status === 'PAID').slice(0, 5)),
    recentAllocations: camel((tenants.data || []).slice(0, 5)),
  };
}

async function getPayments(params: Record<string, any> = {}) {
  let query = supabase
    .from('payments')
    .select('*, tenant:tenants(*, room:rooms(*)), admissionApplication:admission_applications(*), branch:branches(*)');
  if (params.branchId) query = query.eq('branch_id', params.branchId);
  if (params.status) query = query.eq('status', params.status);
  if (params.paymentType) query = query.eq('payment_type', params.paymentType);
  if (params.year) {
    query = query.gte('due_date', startOfMonth(Number(params.year), Number(params.month || 1)));
    query = query.lt('due_date', startOfNextMonth(Number(params.year), Number(params.month || 12)));
  }
  const { data, error } = await query.order('due_date', { ascending: false });
  if (error) throw apiError(error.message);
  return camel(data || []);
}

async function getAdmissions(params: Record<string, any> = {}) {
  let query = supabase.from('admission_applications').select('*, branch:branches(*)');
  if (params.status) query = query.eq('status', params.status);
  if (params.branchId) query = query.eq('branch_id', params.branchId);
  if (params.search) query = query.or(`name.ilike.%${params.search}%,phone.ilike.%${params.search}%`);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw apiError(error.message);
  return camel(data || []);
}

async function getAdmission(id: string) {
  const { data, error } = await supabase
    .from('admission_applications')
    .select('*, branch:branches(*), payments(*), documents(*)')
    .eq('id', id)
    .single();
  if (error) throw apiError(error.message);
  return camel(data);
}

async function reviewAdmission(id: string, payload: any) {
  const application = await getAdmission(id);
  if (application.status !== 'PENDING') throw apiError('This application has already been processed.');

  if (payload.status === 'APPROVED') {
    if (!payload.roomId) throw apiError('Room selection is required for approval.');
    const room = await getRoom(payload.roomId);
    if (room.occupied >= room.capacity) throw apiError('Selected room is fully occupied.');

    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert(
        snakePayload({
          name: application.name,
          phone: application.phone,
          whatsappNumber: application.whatsappNumber,
          address: application.address,
          guardianName: application.guardianName,
          guardianPhone: application.guardianPhone,
          nearestPoliceStation: application.nearestPoliceStation,
          occupation: application.occupation,
          workLocation: application.workLocation,
          joiningDate: application.joiningDate,
          leavingDate: application.leavingDate,
          status: 'ACTIVE',
          profilePhotoUrl: application.profilePhotoUrl,
          aadhaarFrontUrl: application.aadhaarFrontUrl,
          aadhaarBackUrl: application.aadhaarBackUrl,
          roomId: payload.roomId,
        })
      )
      .select()
      .single();
    if (error) throw apiError(error.message);

    await supabase.from('documents').update({ tenant_id: tenant.id }).eq('admission_application_id', id);
    await supabase.from('payments').update({ tenant_id: tenant.id }).eq('admission_application_id', id);
    await supabase.from('admission_applications').update({ status: 'APPROVED' }).eq('id', id);
    await updateRoomOccupancy(payload.roomId);
    await supabase.from('notifications').insert({
      title: 'Admission Approved',
      message: `Application for ${application.name} was approved. Tenant has been allocated to Room ${room.roomNumber}.`,
      type: 'ADMISSION_APPROVED',
    });
    return { message: 'Application approved. Tenant active.', tenant: camel(tenant) };
  }

  await supabase.from('admission_applications').update({ status: 'REJECTED' }).eq('id', id);
  await supabase.from('notifications').insert({
    title: 'Admission Rejected',
    message: `Application for ${application.name} was rejected.`,
    type: 'ADMISSION_APPROVED',
  });
  return { message: 'Application rejected.' };
}

async function getTenant(id: string) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*, room:rooms(*, branch:branches(*)), payments(*)')
    .eq('id', id)
    .single();
  if (error) throw apiError(error.message);
  return camel({ ...data, payments: (data.payments || []).sort((a: any, b: any) => String(b.due_date).localeCompare(String(a.due_date))) });
}

async function getTenants(params: Record<string, any> = {}) {
  let query = supabase.from('tenants').select('*, room:rooms(*, branch:branches(*))');
  if (params.status) query = query.eq('status', params.status);
  if (params.branchId) {
    const { data: branchRooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id')
      .eq('branch_id', params.branchId);
    if (roomsError) throw apiError(roomsError.message);
    const roomIds = (branchRooms || []).map((room: any) => room.id);
    if (roomIds.length === 0) return [];
    query = query.in('room_id', roomIds);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw apiError(error.message);
  let tenants = camel(data || []);
  if (params.search) {
    const search = String(params.search).toLowerCase();
    tenants = tenants.filter((tenant: any) => tenant.name.toLowerCase().includes(search) || tenant.phone.includes(search));
  }
  return tenants;
}

async function recordPayment(id: string, payload: any) {
  const transactionId = payload.transactionId || `manual_${Math.random().toString(36).slice(2, 10)}`;
  const { data: payment, error } = await supabase
    .from('payments')
    .update({
      status: 'PAID',
      paid_date: new Date().toISOString(),
      transaction_id: transactionId,
      payment_method: payload.paymentMethod || 'UPI',
    })
    .eq('id', id)
    .select('*, tenant:tenants(*), admissionApplication:admission_applications(*), branch:branches(*)')
    .single();
  if (error) throw apiError(error.message);

  if (payment.payment_type === 'ADMISSION' && payment.admission_application_id) {
    await supabase
      .from('admission_applications')
      .update({ payment_status: 'PAID', payment_id: transactionId })
      .eq('id', payment.admission_application_id);
  }
  return { message: 'Payment recorded manually successfully', payment: camel(payment) };
}

async function routeGet(path: string, config: RequestConfig = {}) {
  const params = config.params || {};
  if (path === '/branches') return getBranches(params);
  if (path.match(/^\/branches\/[^/]+$/)) return camel((await supabase.from('branches').select('*').eq('id', path.split('/')[2]).single()).data);
  if (path.match(/^\/branches\/[^/]+\/dashboard$/)) return getBranchDashboard(path.split('/')[2]);
  if (path === '/rooms') return getRooms(params);
  if (path.match(/^\/rooms\/[^/]+$/)) return getRoom(path.split('/')[2]);
  if (path === '/admissions') return getAdmissions(params);
  if (path.match(/^\/admissions\/[^/]+$/)) return getAdmission(path.split('/')[2]);
  if (path === '/tenants') return getTenants(params);
  if (path.match(/^\/tenants\/[^/]+$/)) return getTenant(path.split('/')[2]);
  if (path === '/payments') return getPayments(params);
  if (path === '/settings') return getSettingsObject();
  if (path === '/dashboard') return getDashboard();
  if (path === '/notifications') {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    if (error) throw apiError(error.message);
    return camel(data || []);
  }
  throw apiError(`Unsupported Supabase route: GET ${path}`);
}

async function routePost(path: string, body: any = {}) {
  if (path === '/branches') {
    const { data, error } = await supabase.from('branches').insert(snakePayload(body)).select().single();
    if (error) throw apiError(error.message);
    return camel(data);
  }
  if (path === '/rooms') {
    const { data, error } = await supabase.from('rooms').insert(snakePayload(body)).select().single();
    if (error) throw apiError(error.message);
    return camel(data);
  }
  if (path.match(/^\/admissions\/[^/]+\/review$/)) return reviewAdmission(path.split('/')[2], body);
  if (path.match(/^\/tenants\/[^/]+\/move$/)) {
    const tenantId = path.split('/')[2];
    const oldTenant = await getTenant(tenantId);
    const { data, error } = await supabase.from('tenants').update({ room_id: body.newRoomId }).eq('id', tenantId).select().single();
    if (error) throw apiError(error.message);
    await updateRoomOccupancy(oldTenant.roomId);
    await updateRoomOccupancy(body.newRoomId);
    return camel(data);
  }
  if (path.match(/^\/tenants\/[^/]+\/vacate$/)) {
    const tenantId = path.split('/')[2];
    const tenant = await getTenant(tenantId);
    const { data, error } = await supabase.from('tenants').update({ status: 'VACATED' }).eq('id', tenantId).select().single();
    if (error) throw apiError(error.message);
    await updateRoomOccupancy(tenant.roomId);
    return camel(data);
  }
  if (path.match(/^\/tenants\/[^/]+\/rent$/)) {
    const tenantId = path.split('/')[2];
    const tenant = await getTenant(tenantId);
    const days = Number(body.days || 30);
    const discount = Number(body.discountAmount || 0);
    const original = Math.round((Number(tenant.room.monthlyRent) / 30) * days);
    const amount = Math.max(0, original - discount);
    const { data, error } = await supabase
      .from('payments')
      .insert({
        amount,
        status: 'PENDING',
        payment_type: 'RENT',
        due_date: todayIso(),
        days_billed: days,
        original_amount: original,
        discount_amount: discount,
        tenant_id: tenantId,
        branch_id: tenant.room.branchId,
      })
      .select()
      .single();
    if (error) throw apiError(error.message);
    return camel(data);
  }
  if (path === '/payments/generate-dues') {
    const tenants = await getTenants({ status: 'ACTIVE' });
    let generated = 0;
    for (const tenant of tenants) {
      const { count } = await supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('payment_type', 'RENT')
        .gte('due_date', todayIso().slice(0, 8) + '01');
      if (count) continue;
      await supabase.from('payments').insert({
        amount: tenant.room.monthlyRent,
        status: 'PENDING',
        payment_type: 'RENT',
        due_date: todayIso(),
        tenant_id: tenant.id,
        branch_id: tenant.room.branchId,
      });
      generated++;
    }
    return { message: 'Rent dues generation completed successfully.', generated, skippedCount: tenants.length - generated, skippedList: [] };
  }
  if (path.match(/^\/payments\/[^/]+\/record-pay$/)) return recordPayment(path.split('/')[2], body);
  if (path.match(/^\/payments\/[^/]+\/link$/)) {
    const paymentId = path.split('/')[2];
    const [settings, payment] = await Promise.all([getSettingsObject(), getPayments({})]);
    const match = payment.find((item: any) => item.id === paymentId);
    if (!match) throw apiError('Payment record not found');
    const upiPaymentUrl = buildUpiUrl(settings, match.amount, `HostelHub ${match.paymentType} ${match.id}`);
    await supabase.from('payments').update({ payment_method: 'UPI', payment_link_url: upiPaymentUrl }).eq('id', paymentId);
    return { ...match, upiPaymentUrl, paymentLinkUrl: upiPaymentUrl };
  }
  if (path.match(/^\/payments\/[^/]+\/reminder$/)) return { text: '', phone: '', message: 'Reminder ready.' };
  if (path === '/settings') {
    const { data, error } = await supabase
      .from('settings')
      .upsert({ key: body.key, value: String(body.value ?? '') }, { onConflict: 'key' })
      .select()
      .single();
    if (error) throw apiError(error.message);
    return camel(data);
  }
  if (path === '/notifications/all/read') {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    return { message: 'Notifications marked as read' };
  }
  if (path.match(/^\/notifications\/[^/]+\/read$/)) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', path.split('/')[2]);
    return { message: 'Notification marked as read' };
  }
  throw apiError(`Unsupported Supabase route: POST ${path}`);
}

async function routePut(path: string, body: any = {}) {
  if (path.match(/^\/branches\/[^/]+$/)) {
    const { data, error } = await supabase.from('branches').update(snakePayload(body)).eq('id', path.split('/')[2]).select().single();
    if (error) throw apiError(error.message);
    return camel(data);
  }
  if (path.match(/^\/rooms\/[^/]+$/)) {
    const { data, error } = await supabase.from('rooms').update(snakePayload(body)).eq('id', path.split('/')[2]).select().single();
    if (error) throw apiError(error.message);
    return camel(data);
  }
  if (path.match(/^\/payments\/[^/]+\/edit-amount$/)) {
    const { data, error } = await supabase.from('payments').update({ amount: body.amount }).eq('id', path.split('/')[2]).select().single();
    if (error) throw apiError(error.message);
    return camel(data);
  }
  if (path.match(/^\/payments\/[^/]+\/customize$/)) {
    const paymentId = path.split('/')[2];
    const payment = (await getPayments({})).find((item: any) => item.id === paymentId);
    if (!payment) throw apiError('Payment record not found');
    const days = Number(body.days || 30);
    const discount = Number(body.discountAmount || 0);
    const monthlyRent = Number(payment.tenant?.room?.monthlyRent || payment.amount);
    const original = Math.round((monthlyRent / 30) * days);
    const amount = Math.max(0, original - discount);
    const { data, error } = await supabase
      .from('payments')
      .update({ amount, days_billed: days, original_amount: original, discount_amount: discount })
      .eq('id', paymentId)
      .select()
      .single();
    if (error) throw apiError(error.message);
    return camel(data);
  }
  throw apiError(`Unsupported Supabase route: PUT ${path}`);
}

async function routeDelete(path: string) {
  if (path.match(/^\/branches\/[^/]+$/)) return supabase.from('branches').delete().eq('id', path.split('/')[2]);
  if (path.match(/^\/rooms\/[^/]+$/)) return supabase.from('rooms').delete().eq('id', path.split('/')[2]);
  if (path.match(/^\/tenants\/[^/]+$/)) return supabase.from('tenants').delete().eq('id', path.split('/')[2]);
  throw apiError(`Unsupported Supabase route: DELETE ${path}`);
}

const apiClient = {
  async get(path: string, config?: RequestConfig): Promise<ApiResponse> {
    requireSupabaseKey();
    return { data: await routeGet(path, config) };
  },
  async post(path: string, body?: any): Promise<ApiResponse> {
    requireSupabaseKey();
    return { data: await routePost(path, body) };
  },
  async put(path: string, body?: any): Promise<ApiResponse> {
    requireSupabaseKey();
    return { data: await routePut(path, body) };
  },
  async delete(path: string): Promise<ApiResponse> {
    requireSupabaseKey();
    return { data: await routeDelete(path) };
  },
};

export default apiClient;
