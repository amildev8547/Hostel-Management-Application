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

async function getSettings() {
  const { data, error } = await supabase.from("settings").select("key,value");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).map((item: { key: string; value: string }) => [item.key, item.value || ""]));
}

async function renderApplyForm(branchId: string) {
  const [{ data: branch, error: branchError }, { data: rooms, error: roomsError }, settings] = await Promise.all([
    supabase.from("branches").select("*").eq("id", branchId).single(),
    supabase
      .from("rooms")
      .select("room_type,admission_fee,status")
      .eq("branch_id", branchId)
      .neq("status", "MAINTENANCE")
      .order("admission_fee", { ascending: true }),
    getSettings(),
  ]);

  if (branchError || !branch) return textResponse("<h1>Admission form not found</h1>", 404);
  if (roomsError) throw new Error(roomsError.message);

  const roomTypes = Array.from(new Set((rooms || []).map((room: any) => room.room_type).filter(Boolean)));
  const fees: Record<string, number> = {};
  for (const room of rooms || []) {
    if (!fees[room.room_type]) fees[room.room_type] = Number(room.admission_fee || 0);
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
      <label>Name *</label><input name="name" required>
      <label>Phone *</label><input name="phone" required inputmode="numeric" minlength="10" maxlength="10">
      <label>WhatsApp Number *</label><input name="whatsappNumber" required inputmode="numeric" minlength="10" maxlength="10">
      <label>Address *</label><textarea name="address" required></textarea>
      <label>Guardian Name *</label><input name="guardianName" required>
      <label>Guardian Phone *</label><input name="guardianPhone" required inputmode="numeric" minlength="10" maxlength="10">
      <label>Nearest Police Station *</label><input name="nearestPoliceStation" required>
      <label>Occupation *</label><input name="occupation" required>
      <label>Work Location *</label><input name="workLocation" required>
      <label>Joining Date *</label><input name="joiningDate" type="date" required>
      <label>Leaving Date</label><input name="leavingDate" type="date">
      <label>Preferred Room Type *</label>
      <select name="preferredRoomType" id="preferredRoomType" required>
        ${roomTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)} - Rs ${escapeHtml(fees[type] || 0)}</option>`).join("")}
      </select>
      <label>Profile Photo</label><input name="profilePhoto" type="file" accept="image/*"><div class="file-name"></div>
      <label>Aadhaar Front</label><input name="aadhaarFront" type="file" accept="image/*,.pdf"><div class="file-name"></div>
      <label>Aadhaar Back</label><input name="aadhaarBack" type="file" accept="image/*,.pdf"><div class="file-name"></div>
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

async function uploadFile(file: File, applicationId: string, type: string) {
  if (!file || !file.size) return "";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `applications/${applicationId}/${type}-${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`Could not upload ${type}: ${error.message}`);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  await supabase.from("documents").insert({
    file_name: file.name,
    file_type: type,
    storage_path: path,
    bucket,
    public_url: data.publicUrl,
    admission_application_id: applicationId,
  });
  return data.publicUrl;
}

async function submitAdmission(req: Request) {
  const form = await req.formData();
  const branchId = clean(form.get("branchId"));
  const required = ["name", "phone", "whatsappNumber", "address", "guardianName", "guardianPhone", "nearestPoliceStation", "occupation", "workLocation", "joiningDate", "preferredRoomType"];
  for (const key of required) {
    if (!clean(form.get(key))) return jsonResponse({ error: `${key} is required.` }, 400);
  }

  const [{ data: branch, error: branchError }, { data: feeRoom, error: roomError }, settings] = await Promise.all([
    supabase.from("branches").select("*").eq("id", branchId).single(),
    supabase
      .from("rooms")
      .select("admission_fee")
      .eq("branch_id", branchId)
      .eq("room_type", clean(form.get("preferredRoomType")))
      .neq("status", "MAINTENANCE")
      .order("admission_fee", { ascending: true })
      .limit(1)
      .maybeSingle(),
    getSettings(),
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

  const { data: application, error: appError } = await supabase
    .from("admission_applications")
    .insert({
      name: clean(form.get("name")),
      phone,
      whatsapp_number: whatsappNumber,
      address: clean(form.get("address")),
      guardian_name: clean(form.get("guardianName")),
      guardian_phone: guardianPhone,
      nearest_police_station: clean(form.get("nearestPoliceStation")),
      occupation: clean(form.get("occupation")),
      work_location: clean(form.get("workLocation")),
      joining_date: clean(form.get("joiningDate")),
      leaving_date: clean(form.get("leavingDate")) || null,
      preferred_room_type: clean(form.get("preferredRoomType")),
      status: "PENDING",
      payment_status: "PENDING",
      branch_id: branchId,
    })
    .select()
    .single();

  if (appError) throw new Error(appError.message);

  try {
    const [profilePhotoUrl, aadhaarFrontUrl, aadhaarBackUrl] = await Promise.all([
      uploadFile(form.get("profilePhoto") as File, application.id, "profile_photo"),
      uploadFile(form.get("aadhaarFront") as File, application.id, "aadhaar_front"),
      uploadFile(form.get("aadhaarBack") as File, application.id, "aadhaar_back"),
    ]);

    await supabase
      .from("admission_applications")
      .update({ profile_photo_url: profilePhotoUrl || null, aadhaar_front_url: aadhaarFrontUrl || null, aadhaar_back_url: aadhaarBackUrl || null })
      .eq("id", application.id);

    const amount = Number(feeRoom?.admission_fee || 0);
    const upiPaymentUrl = buildUpiUrl(
      String(settings.payment_upi_id || ""),
      String(settings.payment_receiver_name || branch.name),
      amount,
      `HostelHub admission ${application.id}`,
    );

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        amount,
        status: "PENDING",
        payment_type: "ADMISSION",
        due_date: new Date().toISOString().slice(0, 10),
        payment_method: "UPI",
        payment_link_url: upiPaymentUrl,
        admission_application_id: application.id,
        branch_id: branchId,
      })
      .select()
      .single();

    if (paymentError) throw new Error(paymentError.message);

    await supabase.from("notifications").insert({
      title: "New Admission Application",
      message: `${application.name} submitted an admission application for ${branch.name}.`,
      type: "ADMISSION_RECEIVED",
    });

    return jsonResponse({ applicationId: application.id, paymentId: payment.id, upiPaymentUrl });
  } catch (error) {
    await supabase.from("documents").delete().eq("admission_application_id", application.id);
    await supabase.from("payments").delete().eq("admission_application_id", application.id);
    await supabase.from("admission_applications").delete().eq("id", application.id);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return textResponse("", 204, "text/plain");

  try {
    const path = functionPath(req);
    const applyMatch = path.match(/^\/apply\/([^/]+)$/);
    if (req.method === "GET" && applyMatch) return await renderApplyForm(decodeURIComponent(applyMatch[1]));
    if (req.method === "POST" && path === "/api/admissions/apply") return await submitAdmission(req);
    return textResponse("<h1>Not found</h1>", 404);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Something went wrong. Please try again." }, 500);
  }
});

