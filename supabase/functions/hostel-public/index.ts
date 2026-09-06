import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const bucket = "tenant-documents";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

function textResponse(body: string, status = 200, contentType = "text/html; charset=utf-8") {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": contentType },
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return textResponse(JSON.stringify(body), status, "application/json; charset=utf-8");
}

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validateUpload(file: FormDataEntryValue | null, label: string) {
  if (!(file instanceof File) || !file.size) return "";
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return `${label} must be a JPG, PNG, WEBP, or PDF file.`;
  }
  if (file.size > 5 * 1024 * 1024) {
    return `${label} must be smaller than 5 MB.`;
  }
  return "";
}

function buildUpiUrl(upiId: string, receiver: string, amount: number, note: string) {
  if (!upiId) return "";
  const params = new URLSearchParams({
    pa: upiId,
    pn: receiver || "HostelHub",
    am: String(amount),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

function functionPath(req: Request) {
  const path = new URL(req.url).pathname;
  return path.replace(/^\/hostel-public/, "") || "/";
}

async function getSettings(ownerEmail: string) {
  const { data, error } = await supabase.from("settings").select("key,value").eq("owner_email", ownerEmail);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).map((item: { key: string; value: string }) => [item.key, item.value || ""]));
}

async function renderApplyForm(branchId: string, booking?: any) {
  const [{ data: branch, error: branchError }, { data: rooms, error: roomsError }] = await Promise.all([
    supabase.from("branches").select("*").eq("id", branchId).single(),
    supabase
      .from("rooms")
      .select("room_type,monthly_rent,admission_fee,status")
      .eq("branch_id", branchId)
      .neq("status", "MAINTENANCE")
      .order("admission_fee", { ascending: true }),
  ]);

  if (branchError || !branch) return textResponse("<h1>Admission form not found</h1>", 404);
  if (roomsError) throw new Error(roomsError.message);
  const settings = await getSettings(branch.owner_email);

  const roomTypes = Array.from(new Set((rooms || []).map((room: any) => room.room_type).filter(Boolean)));
  const fees: Record<string, number> = {};
  const rents: Record<string, number> = {};
  for (const room of rooms || []) {
    if (!fees[room.room_type]) fees[room.room_type] = Number(room.admission_fee || 0);
    if (!rents[room.room_type]) rents[room.room_type] = Number(room.monthly_rent || 0);
  }
  const firstType = roomTypes[0] || "2 Share";
  const amount = fees[firstType] || 0;
  const upiUrl = buildUpiUrl(
    String(settings.payment_upi_id || ""),
    String(settings.payment_receiver_name || branch.name),
    amount,
    `HostelHub admission ${branchId}`,
  );

  return textResponse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(branch.name)} Admission</title>
  <style>
    body{margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a}
    main{max-width:720px;margin:0 auto;padding:22px}
    header{padding:22px 0 14px}
    h1{font-size:26px;margin:0 0 6px}
    p{color:#475569;line-height:1.45}
    form{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:18px}
    label{display:block;font-weight:700;margin:14px 0 6px}
    input,select,textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:12px;font-size:16px;background:#fff}
    textarea{min-height:86px}
    button,a.button{display:block;width:100%;box-sizing:border-box;border:0;border-radius:8px;padding:14px;margin-top:16px;text-align:center;font-size:16px;font-weight:800;text-decoration:none}
    button{background:#4f46e5;color:white}
    a.button{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}
    .muted{font-size:13px;color:#64748b}
    .message{display:none;border-radius:8px;padding:12px;margin:12px 0;font-weight:700}
    .success{background:#dcfce7;color:#166534}
    .error{background:#fee2e2;color:#991b1b}
    .file-name{font-size:13px;color:#475569;margin-top:5px}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(branch.name)}</h1>
      <p>${escapeHtml(branch.address)}</p>
    </header>
    <div id="message" class="message"></div>
    <form id="admissionForm">
      <input type="hidden" name="branchId" value="${escapeHtml(branchId)}">
      <input type="hidden" name="bookingToken" value="${escapeHtml(booking?.secure_token || "")}">
      ${booking ? `<p class="muted"><strong>Reserved:</strong> Room ${escapeHtml(booking.room?.room_number)}, bed ${escapeHtml(booking.bed_number)}. These booking details cannot be changed.</p>` : ""}
      <label>Name *</label><input name="name" required value="${escapeHtml(booking?.name || "")}" ${booking ? "readonly" : ""}>
      <label>Phone *</label><input name="phone" required inputmode="numeric" minlength="10" maxlength="10" value="${escapeHtml(booking?.phone || "")}" ${booking ? "readonly" : ""}>
      <label>WhatsApp Number *</label><input name="whatsappNumber" required inputmode="numeric" minlength="10" maxlength="10">
      <label>Address *</label><textarea name="address" required></textarea>
      <label>Guardian Name *</label><input name="guardianName" required>
      <label>Guardian Phone *</label><input name="guardianPhone" required inputmode="numeric" minlength="10" maxlength="10">
      <label>Nearest Police Station *</label><input name="nearestPoliceStation" required>
      <label>Occupation *</label><input name="occupation" required>
      <label>Work Location *</label><input name="workLocation" required>
      <label>Joining Date *</label><input name="joiningDate" type="date" required value="${escapeHtml(booking?.expected_joining_date || "")}" ${booking ? "readonly" : ""}>
      <label>Leaving Date</label><input name="leavingDate" type="date">
      <label>Preferred Room Type *</label>
      <select name="preferredRoomType" id="preferredRoomType" required>
        ${roomTypes.map((type) => `<option value="${escapeHtml(type)}" ${booking?.room?.room_type === type ? "selected" : ""}>${escapeHtml(type)} - Monthly rent Rs ${escapeHtml(rents[type] || 0)} - One-time admission fee Rs ${escapeHtml(fees[type] || 0)}</option>`).join("")}
      </select>
      <label>Profile Photo *</label><input name="profilePhoto" type="file" accept="image/*" required><div class="file-name"></div>
      <label>Aadhaar Front *</label><input name="aadhaarFront" type="file" accept="image/*" required><div class="file-name"></div>
      <label>Aadhaar Back *</label><input name="aadhaarBack" type="file" accept="image/*" required><div class="file-name"></div>
      <p class="muted">After submission, pay using the UPI button shown below and share the screenshot on WhatsApp.</p>
      <button type="submit">Submit Application</button>
      ${upiUrl ? `<a class="button" href="${escapeHtml(upiUrl)}">Pay Admission Fee by UPI</a>` : ""}
    </form>
  </main>
  <script>
    const form = document.getElementById('admissionForm');
    const msg = document.getElementById('message');
    for (const input of document.querySelectorAll('input[type=file]')) {
      input.addEventListener('change', () => {
        input.nextElementSibling.textContent = input.files && input.files[0] ? input.files[0].name : '';
      });
    }
    function show(type, text) {
      msg.className = 'message ' + type;
      msg.textContent = text;
      msg.style.display = 'block';
      msg.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type=submit]');
      submit.disabled = true;
      submit.textContent = 'Submitting...';
      try {
        const response = await fetch('/hostel-public/api/admissions/apply', { method: 'POST', body: new FormData(form) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to submit application.');
        show('success', 'Application submitted successfully. Please complete the UPI payment and share the screenshot on WhatsApp.');
        if (result.upiPaymentUrl) window.location.href = result.upiPaymentUrl;
        form.reset();
        for (const el of document.querySelectorAll('.file-name')) el.textContent = '';
      } catch (error) {
        show('error', error.message || 'Unable to submit application. Please try again.');
      } finally {
        submit.disabled = false;
        submit.textContent = 'Submit Application';
      }
    });
  </script>
</body>
</html>`);
}

async function uploadFile(file: File, uploadId: string, type: string) {
  if (!file || !file.size) return "";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `applications/${uploadId}/${type}-${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`Could not upload ${type}: ${error.message}`);
  return { path, fileName: file.name, fileType: type };
}

async function submitAdmission(req: Request) {
  const form = await req.formData();
  const branchId = clean(form.get("branchId"));
  const bookingToken = clean(form.get("bookingToken"));
  const required = ["name", "phone", "whatsappNumber", "address", "guardianName", "guardianPhone", "nearestPoliceStation", "occupation", "workLocation", "joiningDate", "preferredRoomType"];
  for (const key of required) {
    if (!clean(form.get(key))) return jsonResponse({ error: `${key} is required.` }, 400);
  }

  const { data: booking, error: bookingError } = bookingToken
    ? await supabase.from("bookings").select("*,room:rooms(*)").eq("secure_token", bookingToken).maybeSingle()
    : { data: null, error: null };
  if (bookingError) throw new Error(bookingError.message);
  if (bookingToken && (!booking || booking.status !== "RESERVED")) return jsonResponse({ error: "This booking link is no longer active." }, 409);
  const selectedBranchId = booking?.branch_id || branchId;
  const [{ data: branch, error: branchError }, { data: feeRoom, error: roomError }] = await Promise.all([
    supabase.from("branches").select("*").eq("id", selectedBranchId).single(),
    supabase
      .from("rooms")
      .select("admission_fee")
      .eq("branch_id", selectedBranchId)
      .eq("room_type", booking?.room?.room_type || clean(form.get("preferredRoomType")))
      .neq("status", "MAINTENANCE")
      .order("admission_fee", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (branchError || !branch) return jsonResponse({ error: "Branch not found. Please ask the owner for a fresh link." }, 404);
  if (roomError) throw new Error(roomError.message);

  const phone = digits(clean(form.get("phone"))).slice(-10);
  const whatsappNumber = digits(clean(form.get("whatsappNumber"))).slice(-10);
  const guardianPhone = digits(clean(form.get("guardianPhone"))).slice(-10);
  if (phone.length !== 10 || whatsappNumber.length !== 10 || guardianPhone.length !== 10) {
    return jsonResponse({ error: "Phone, WhatsApp, and guardian phone must be exactly 10 digits." }, 400);
  }

  for (const [field, label] of [
    ["profilePhoto", "Profile photo"],
    ["aadhaarFront", "Aadhaar front"],
    ["aadhaarBack", "Aadhaar back"],
  ]) {
    const validationError = validateUpload(form.get(field), label);
    if (validationError) return jsonResponse({ error: validationError }, 400);
  }

  const uploadId = crypto.randomUUID();
  let uploads: { path: string; fileName: string; fileType: string }[] = [];
  try {
    uploads = await Promise.all([
      uploadFile(form.get("profilePhoto") as File, uploadId, "PROFILE_PHOTO"),
      uploadFile(form.get("aadhaarFront") as File, uploadId, "AADHAAR_FRONT"),
      uploadFile(form.get("aadhaarBack") as File, uploadId, "AADHAAR_BACK"),
    ]);
    const payload = {
      booking_token: bookingToken || null, branch_id: selectedBranchId,
      name: clean(form.get("name")), phone, whatsapp_number: whatsappNumber,
      address: clean(form.get("address")), guardian_name: clean(form.get("guardianName")),
      guardian_phone: guardianPhone, nearest_police_station: clean(form.get("nearestPoliceStation")),
      occupation: clean(form.get("occupation")), work_location: clean(form.get("workLocation")),
      joining_date: clean(form.get("joiningDate")), leaving_date: clean(form.get("leavingDate")),
      preferred_room_type: booking?.room?.room_type || clean(form.get("preferredRoomType")), notes: clean(form.get("notes")),
      profile_photo_path: uploads[0].path, aadhaar_front_path: uploads[1].path, aadhaar_back_path: uploads[2].path,
      documents: uploads.map((item) => ({ file_name: item.fileName, file_type: item.fileType, storage_path: item.path })),
    };
    const { data: result, error: rpcError } = await supabase.rpc("create_public_admission", { p_payload: payload });
    if (rpcError) throw new Error(rpcError.message);
    const settings = await getSettings(branch.owner_email);
    const amount = Number(result.amount || feeRoom?.admission_fee || 0);
    const upiPaymentUrl = buildUpiUrl(
      String(settings.payment_upi_id || ""),
      String(settings.payment_receiver_name || branch.name),
      amount,
      `HostelHub admission ${result.application_id}`,
    );
    const manualPaymentUrl = `${supabaseUrl}/functions/v1/hostel-public/pay/${result.payment_id}`;
    await supabase.from("payments").update({ payment_link_url: upiPaymentUrl || manualPaymentUrl }).eq("id", result.payment_id);
    return jsonResponse({ applicationId: result.application_id, paymentId: result.payment_id, paymentLink: upiPaymentUrl || manualPaymentUrl, upiPaymentUrl });
  } catch (error) {
    if (uploads.length) await supabase.storage.from(bucket).remove(uploads.map((item) => item.path));
    throw error;
  }
}

async function renderBookingForm(token: string) {
  const { data: booking, error } = await supabase.from("bookings").select("*,room:rooms(*),branch:branches(*)").eq("secure_token", token).maybeSingle();
  if (error || !booking) return textResponse("<h1>This booking link is not valid</h1>", 404);
  if (booking.status !== "RESERVED") return textResponse(`<h1>${booking.status === "FORM_SUBMITTED" ? "Application already submitted" : "This booking is already completed"}</h1>`, 409);
  return renderApplyForm(booking.branch_id, booking);
}

async function renderPayment(paymentId: string) {
  const { data: payment, error } = await supabase.from("payments").select("*,branch:branches(*),tenant:tenants(*,room:rooms(*)),admissionApplication:admission_applications(*)").eq("id", paymentId).maybeSingle();
  if (error || !payment) return textResponse("<h1>Invoice details not found</h1>", 404);
  const settings = await getSettings(payment.owner_email);
  const payer = payment.tenant?.name || payment.admissionApplication?.name || "Applicant";
  const note = `HostelHub ${payment.payment_type} ${payment.id}`;
  const upi = buildUpiUrl(settings.payment_upi_id || "", settings.payment_receiver_name || payment.branch.name, Number(payment.amount), note);
  const whatsapp = digits(settings.payment_whatsapp_number || "");
  return textResponse(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Pay by UPI</title><style>body{font-family:Arial;background:#f8fafc;margin:0;padding:24px;color:#0f172a}.card{max-width:480px;margin:auto;background:white;padding:24px;border-radius:14px;border:1px solid #e2e8f0}.amount{font-size:36px;font-weight:800;color:#2563eb;text-align:center}.btn{display:block;padding:14px;margin-top:14px;border-radius:9px;text-align:center;text-decoration:none;font-weight:800;background:#2563eb;color:white}.wa{background:#16a34a}.muted{color:#64748b}</style></head><body><div class="card"><h1>Pay by UPI</h1><p class="muted">${escapeHtml(payment.branch.name)}</p><div class="amount">Rs ${escapeHtml(payment.amount)}</div><p><b>Name:</b> ${escapeHtml(payer)}</p><p><b>Invoice:</b> ${escapeHtml(payment.id)}</p>${upi ? `<a class="btn" href="${escapeHtml(upi)}">Open UPI App</a>` : `<p>UPI ID is not configured. Contact the hostel owner.</p>`}<p>After paying, take a screenshot and share it with the hostel owner.</p><a class="btn wa" href="${whatsapp ? `https://wa.me/91${escapeHtml(whatsapp)}` : "https://wa.me/"}">Share on WhatsApp</a></div></body></html>`);
}

async function formDetails(url: URL) {
  const bookingToken = clean(url.searchParams.get("bookingToken"));
  let booking: any = null;
  if (bookingToken) {
    const result = await supabase.from("bookings").select("*,room:rooms(*),branch:branches(*)").eq("secure_token", bookingToken).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    booking = result.data;
    if (!booking) return jsonResponse({ error: "This booking link is not valid." }, 404);
    if (booking.status !== "RESERVED") return jsonResponse({ error: booking.status === "FORM_SUBMITTED" ? "Application already submitted." : "This booking is already completed." }, 409);
  }
  const branchId = booking?.branch_id || clean(url.searchParams.get("branchId"));
  const [{ data: branch, error: branchError }, { data: rooms, error: roomsError }] = await Promise.all([
    supabase.from("branches").select("id,name,address,owner_email").eq("id", branchId).eq("status", "ACTIVE").maybeSingle(),
    supabase.from("rooms").select("room_type,monthly_rent,admission_fee").eq("branch_id", branchId).neq("status", "MAINTENANCE").order("monthly_rent"),
  ]);
  if (branchError || !branch) return jsonResponse({ error: "Branch not found." }, 404);
  if (roomsError) throw new Error(roomsError.message);
  const roomTypes = Object.values((rooms || []).reduce((result: Record<string, any>, room: any) => {
    if (!result[room.room_type]) result[room.room_type] = { name: room.room_type, monthlyRent: Number(room.monthly_rent), admissionFee: Number(room.admission_fee) };
    return result;
  }, {}));
  return jsonResponse({
    branch: { id: branch.id, name: branch.name, address: branch.address }, roomTypes,
    booking: booking ? { name: booking.name, phone: booking.phone, expectedJoiningDate: booking.expected_joining_date, bedNumber: booking.bed_number, roomNumber: booking.room.room_number, roomType: booking.room.room_type, monthlyRent: Number(booking.room.monthly_rent), admissionFee: Number(booking.room.admission_fee) } : null,
  });
}

async function paymentDetails(url: URL) {
  const paymentId = clean(url.searchParams.get("paymentId"));
  const { data: payment, error } = await supabase.from("payments").select("id,amount,payment_type,due_date,owner_email,branch:branches(name),tenant:tenants(name,room:rooms(room_number)),admissionApplication:admission_applications(name)").eq("id", paymentId).maybeSingle();
  if (error || !payment) return jsonResponse({ error: "Invoice details not found." }, 404);
  const settings = await getSettings(payment.owner_email);
  const payerName = payment.tenant?.name || payment.admissionApplication?.name || "Applicant";
  return jsonResponse({
    id: payment.id, amount: Number(payment.amount), paymentType: payment.payment_type,
    dueDate: payment.due_date, branchName: payment.branch?.name, payerName,
    roomNumber: payment.tenant?.room?.room_number || null,
    upiId: settings.payment_upi_id || "", receiverName: settings.payment_receiver_name || payment.branch?.name || "HostelHub",
    whatsappNumber: digits(settings.payment_whatsapp_number || ""),
    upiUrl: buildUpiUrl(settings.payment_upi_id || "", settings.payment_receiver_name || payment.branch?.name || "HostelHub", Number(payment.amount), `HostelHub ${payment.payment_type} ${payment.id}`),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return textResponse("", 204, "text/plain");

  try {
    const path = functionPath(req);
    const url = new URL(req.url);
    if (req.method === "GET" && path === "/api/form") return await formDetails(url);
    if (req.method === "GET" && path === "/api/payment") return await paymentDetails(url);
    const applyMatch = path.match(/^\/apply\/([^/]+)$/);
    if (req.method === "GET" && applyMatch) return await renderApplyForm(decodeURIComponent(applyMatch[1]));
    const bookingMatch = path.match(/^\/book\/([^/]+)$/);
    if (req.method === "GET" && bookingMatch) return await renderBookingForm(decodeURIComponent(bookingMatch[1]));
    const paymentMatch = path.match(/^\/pay\/([^/]+)$/);
    if (req.method === "GET" && paymentMatch) return await renderPayment(decodeURIComponent(paymentMatch[1]));
    if (req.method === "POST" && path === "/api/admissions/apply") return await submitAdmission(req);
    return textResponse("<h1>Not found</h1>", 404);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Something went wrong. Please try again." }, 500);
  }
});
