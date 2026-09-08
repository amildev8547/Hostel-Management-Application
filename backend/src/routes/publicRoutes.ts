import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function onlyDigits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '');
}

function settingValue(settings: { key: string; value: string }[] | undefined, key: string) {
  return settings?.find((setting) => setting.key === key)?.value?.trim() || '';
}

// Public admission form. A secure booking link locks the reserved branch, room, bed and basic details.
router.get(['/apply/:branchId', '/book/:bookingToken'], async (req: Request, res: Response) => {
  const booking = req.params.bookingToken
    ? await prisma.booking.findUnique({ where: { secureToken: req.params.bookingToken }, include: { room: true, branch: true } })
    : null;
  if (req.params.bookingToken && !booking) return res.status(404).send('<h1>This booking link is not valid</h1>');
  if (booking && booking.status !== 'RESERVED') {
    return res.status(409).send(`<h1>${booking.status === 'FORM_SUBMITTED' ? 'Application already submitted' : 'This booking is already completed'}</h1>`);
  }
  const branchId = booking?.branchId || req.params.branchId;

  try {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      return res.status(404).send('<h1>Branch not found</h1>');
    }

    // Build a roomType -> cheapest admissionFee map so the displayed fee always matches
    // real room pricing instead of a hardcoded flat number.
    const rooms = await prisma.room.findMany({
      where: { branchId },
      select: { roomType: true, admissionFee: true, monthlyRent: true },
      orderBy: { admissionFee: 'asc' },
    });
    const roomFeeMap: Record<string, number> = {};
    const roomRentMap: Record<string, number> = {};
    let cheapestOverall = 1500;
    for (const room of rooms) {
      if (!(room.roomType in roomFeeMap)) {
        roomFeeMap[room.roomType] = room.admissionFee;
        roomRentMap[room.roomType] = room.monthlyRent;
      }
      cheapestOverall = Math.min(cheapestOverall, room.admissionFee);
    }

    // Serve a beautiful self-contained HTML page
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hostel Admission Form - ${escapeHtml(branch.name)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary: #5B4CF0;
            --primary-hover: #4938DB;
            --background: #F4F7FB;
            --card-bg: #FFFFFF;
            --text-main: #1F2937;
            --text-muted: #6B7280;
            --border: #E5E7EB;
            --success: #10B981;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html { -webkit-text-size-adjust: 100%; }
          body {
            font-family: 'Inter', sans-serif;
            background: radial-gradient(circle at top left, #EDE9FE 0, transparent 32rem), var(--background);
            color: var(--text-main);
            line-height: 1.5;
            padding: 2rem 1rem;
            overflow-x: hidden;
          }
          .container {
            max-width: 760px;
            margin: 0 auto;
            background: var(--card-bg);
            border-radius: 24px;
            box-shadow: 0 24px 70px rgba(30, 41, 59, 0.12);
            border: 1px solid rgba(255,255,255,0.8);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #111827 0%, #312E81 58%, #5B4CF0 100%);
            color: white;
            padding: 2.5rem;
            text-align: left;
          }
          .brand-mark { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 14px; background: rgba(255,255,255,.16); font-size: 1.4rem; margin-bottom: 1.3rem; }
          .eyebrow { font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; opacity: .72; margin-bottom: .55rem; }
          .header h1 { font-size: clamp(1.7rem, 5vw, 2.35rem); line-height: 1.15; font-weight: 800; margin-bottom: 0.65rem; }
          .header p { font-size: 0.95rem; opacity: 0.82; }
          .secure-note { display: flex; align-items: center; gap: .45rem; margin-top: 1.25rem; font-size: .78rem; opacity: .76; }
          form { padding: 2.25rem; display: grid; gap: 1.35rem; }
          form > *, .form-group, .form-row > * { min-width: 0; }
          .section-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #111827;
            border: 0;
            padding: 1.15rem 0 .25rem;
            margin-top: .25rem;
            display: flex;
            align-items: center;
            gap: .65rem;
          }
          .section-title::before { content: ''; width: 9px; height: 28px; border-radius: 999px; background: linear-gradient(180deg, #7C3AED, #4F46E5); }
          .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
          .form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
          label { font-size: 0.9rem; font-weight: 600; color: var(--text-main); }
          input, textarea, select {
            width: 100%;
            padding: 0.9rem 1rem;
            border: 1px solid #D7DDEA;
            border-radius: 12px;
            background: #FBFCFE;
            font-family: inherit;
            font-size: 0.95rem;
            transition: all 0.2s;
            outline: none;
            min-width: 0;
            max-width: 100%;
          }
          input:focus, textarea:focus, select:focus {
            border-color: var(--primary);
            background: white;
            box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.11);
          }
          .uploads-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.9rem;
          }
          .upload-card {
            display: flex;
            flex-direction: column;
            gap: 0.7rem;
            align-items: center;
            justify-content: flex-start;
            min-width: 0;
            min-height: 270px;
            padding: 1rem;
            border: 1px solid var(--border);
            border-radius: 16px;
            background: linear-gradient(180deg, #FFFFFF 0%, #FAFAFF 100%);
            text-align: center;
            transition: border-color .2s, box-shadow .2s, transform .2s;
          }
          .upload-card:hover {
            border-color: #A5B4FC;
            box-shadow: 0 10px 26px rgba(79, 70, 229, .09);
            transform: translateY(-1px);
          }
          .upload-card:focus-within {
            border-color: var(--primary);
            box-shadow: 0 0 0 4px rgba(79, 70, 229, .11);
          }
          .upload-visual {
            width: 104px;
            height: 104px;
            margin-bottom: .1rem;
          }
          .upload-preview {
            width: 100%;
            height: 100%;
            border-radius: 14px;
            object-fit: cover;
            background: #EEF2FF;
            border: 1px solid #C7D2FE;
            display: none;
          }
          .profile-upload .upload-preview,
          .profile-upload .upload-placeholder { border-radius: 50%; }
          .upload-placeholder {
            width: 100%;
            height: 100%;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(145deg, #EEF2FF, #EDE9FE);
            color: #4F46E5;
            font-size: 2rem;
            border: 1px solid #D8DEFF;
          }
          .upload-card.has-file .upload-preview { display: block; }
          .upload-card.has-file .upload-placeholder { display: none; }
          .upload-title { font-size: 0.94rem; font-weight: 700; color: #111827; }
          .upload-hint { color: var(--text-muted); font-size: .76rem; min-height: 2.3em; }
          .file-input-wrapper {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 44px;
            padding: .65rem .8rem;
            border: 1px solid #C7D2FE;
            border-radius: 11px;
            background: #EEF2FF;
            color: #4338CA;
            cursor: pointer;
          }
          .file-input-wrapper.selected { background: #E0E7FF; border-color: #818CF8; }
          .file-label { font-size: .82rem; font-weight: 700; }
          .visually-hidden-file {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }
          .file-meta {
            width: 100%;
            color: var(--text-muted);
            font-size: 0.73rem;
            line-height: 1.35;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .summary-card { background: #F8FAFC; padding: 1rem; border-radius: 12px; border: 1px solid var(--border); }
          .summary-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.3rem 0; }
          .summary-row strong { text-align: right; }
          .message-panel {
            display: none;
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid transparent;
            font-size: 0.92rem;
            font-weight: 600;
            white-space: pre-line;
          }
          .message-panel.error {
            display: block;
            background: #FEF2F2;
            border-color: #FCA5A5;
            color: #991B1B;
          }
          .message-panel.success {
            display: block;
            background: #ECFDF5;
            border-color: #86EFAC;
            color: #065F46;
          }
          .message-panel.info {
            display: block;
            background: #EEF2FF;
            border-color: #C7D2FE;
            color: #3730A3;
          }
          .help-text {
            color: var(--text-muted);
            font-size: 0.78rem;
          }
          .btn-submit {
            background: linear-gradient(135deg, #5B4CF0, #7C3AED);
            color: white;
            border: none;
            padding: 1rem;
            font-size: 1rem;
            font-weight: 600;
            border-radius: 14px;
            cursor: pointer;
            transition: background 0.2s;
            margin-top: 1rem;
            min-height: 56px;
            box-shadow: 0 12px 24px rgba(91,76,240,.22);
          }
          .btn-submit:hover { background-color: var(--primary-hover); }
          .btn-submit:disabled { background-color: var(--text-muted); cursor: not-allowed; }
          @media (max-width: 720px) {
            .uploads-grid { grid-template-columns: 1fr; }
            .upload-card {
              display: grid;
              grid-template-columns: 92px minmax(0, 1fr);
              grid-template-areas:
                "visual title"
                "visual hint"
                "visual trigger"
                "meta meta";
              min-height: 0;
              text-align: left;
              align-items: center;
            }
            .upload-visual { grid-area: visual; width: 92px; height: 92px; margin: 0; }
            .upload-title { grid-area: title; align-self: end; }
            .upload-hint { grid-area: hint; min-height: 0; }
            .file-input-wrapper { grid-area: trigger; }
            .file-meta { grid-area: meta; text-align: left; }
          }
          @media (max-width: 600px) {
            .form-row { grid-template-columns: 1fr; }
            body { padding: 0; }
            .container { border: 0; border-radius: 0; box-shadow: none; }
            .header { padding: 1.75rem 1.25rem; }
            form { padding: 1.25rem; gap: 1.25rem; }
            .summary-row { align-items: flex-start; }
          }
          @media (max-width: 390px) {
            .header { padding: 1.5rem 1rem; }
            form { padding: 1rem; }
            .upload-card { grid-template-columns: 76px minmax(0, 1fr); padding: .85rem; }
            .upload-visual { width: 76px; height: 76px; }
            .file-input-wrapper { min-height: 42px; padding: .55rem .65rem; }
            .summary-row { flex-direction: column; gap: .1rem; }
            .summary-row strong { text-align: left; }
          }
          .loading-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255, 255, 255, 0.8);
            display: none; align-items: center; justify-content: center; text-align: center;
            font-size: 1.2rem; font-weight: 600; z-index: 1000;
            padding: 1rem;
          }
          .form-footer { text-align: center; color: var(--text-muted); font-size: .76rem; padding: 0 1rem 1.5rem; }
        </style>
      </head>
      <body>
        <div class="loading-overlay" id="loadingOverlay">Processing application, please wait...</div>
        <div class="container">
          <div class="header">
            <div class="brand-mark">🏠</div>
            <div class="eyebrow">HostelHub admission</div>
            <h1>Hostel Admission Form</h1>
            <p>Apply to stay at <strong>${escapeHtml(branch.name)}</strong></p>
            <div class="secure-note">🔒 Your information and documents are submitted securely.</div>
          </div>
          <form id="admissionForm">
            <div id="messagePanel" class="message-panel" role="status" aria-live="polite"></div>

            ${booking ? `<div class="message-panel info" style="display:block"><strong>Your reserved place</strong><br>${escapeHtml(booking.branch.name)} · Room ${escapeHtml(booking.room.roomNumber)} · Bed ${escapeHtml(booking.bedNumber)}<br>These booking details are fixed. Complete the remaining information below.</div>` : ''}

            <h2 class="section-title">Personal Details</h2>
            <div class="form-group">
              <label for="name">Full Name *</label>
              <input type="text" id="name" required placeholder="John Doe" value="${escapeHtml(booking?.name)}" ${booking ? 'readonly' : ''}>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="phone">Phone Number *</label>
                <input type="tel" id="phone" required inputmode="numeric" minlength="10" placeholder="9876543210" value="${escapeHtml(booking?.phone)}" ${booking ? 'readonly' : ''}>
                <span class="help-text">Enter a 10 digit mobile number.</span>
              </div>
              <div class="form-group">
                <label for="whatsappNumber">WhatsApp Number *</label>
                <input type="tel" id="whatsappNumber" required inputmode="numeric" minlength="10" placeholder="9876543210" value="${escapeHtml(booking?.phone)}">
                <span class="help-text">Enter the WhatsApp number without country code.</span>
              </div>
            </div>
            <div class="form-group">
              <label for="address">Permanent Address *</label>
              <textarea id="address" rows="3" required placeholder="Enter full address"></textarea>
            </div>

            <h2 class="section-title">Guardian & Reference Details</h2>
            <div class="form-row">
              <div class="form-group">
                <label for="guardianName">Guardian Name *</label>
                <input type="text" id="guardianName" required placeholder="Father/Mother Name">
              </div>
              <div class="form-group">
                <label for="guardianPhone">Guardian Phone *</label>
                <input type="tel" id="guardianPhone" required inputmode="numeric" minlength="10" placeholder="9876543210">
                <span class="help-text">Enter a 10 digit guardian number.</span>
              </div>
            </div>
            <div class="form-group">
              <label for="nearestPoliceStation">Nearest Police Station *</label>
              <input type="text" id="nearestPoliceStation" required placeholder="Local police station name">
            </div>

            <h2 class="section-title">Work / Study Details</h2>
            <div class="form-row">
              <div class="form-group">
                <label for="occupation">Occupation *</label>
                <input type="text" id="occupation" required placeholder="Student / Employee">
              </div>
              <div class="form-group">
                <label for="workLocation">Work / Institution Location *</label>
                <input type="text" id="workLocation" required placeholder="Office/College name and location">
              </div>
            </div>

            <h2 class="section-title">Preferences & Schedule</h2>
            <div class="form-row">
              <div class="form-group">
                <label for="preferredRoomType">Preferred Room Type *</label>
                <select id="preferredRoomType" required ${booking ? 'disabled' : ''}>
                  ${Object.keys(roomFeeMap).map((type) => `<option value="${escapeHtml(type)}" ${booking?.room.roomType === type ? 'selected' : ''}>${escapeHtml(type.replace('Share', 'people'))} · ₹${escapeHtml(roomRentMap[type])}/month</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="joiningDate">Expected Joining Date *</label>
                <input type="date" id="joiningDate" required value="${booking ? booking.expectedJoiningDate.toISOString().split('T')[0] : ''}" ${booking ? 'readonly' : ''}>
              </div>
            </div>
            <div class="form-group">
              <label for="leavingDate">Expected Leaving Date (Optional)</label>
              <input type="date" id="leavingDate">
            </div>

            <h2 class="section-title" id="requiredDocuments">Required Documents</h2>
            <div class="uploads-grid">
              <div class="upload-card profile-upload" id="profileCard">
                <div class="upload-visual"><div class="upload-placeholder">👤</div><img class="upload-preview" id="profilePreview" alt="Selected profile photo preview"></div>
                <div class="upload-title">Profile photo *</div>
                <div class="upload-hint">Use a recent, clear face photo.</div>
                <label class="file-input-wrapper" id="profileWrapper" for="profilePhoto"><span class="file-label" id="profilePhotoLabel">Choose photo</span></label>
                <div class="file-meta" id="profileMeta">JPG, PNG or WEBP</div>
                <input class="visually-hidden-file" type="file" id="profilePhoto" accept="image/jpeg,image/png,image/webp" required>
              </div>
              <div class="upload-card" id="aadhaarFrontCard">
                <div class="upload-visual"><div class="upload-placeholder">🪪</div><img class="upload-preview" id="aadhaarFrontPreview" alt="Aadhaar front preview"></div>
                <div class="upload-title">Aadhaar front *</div>
                <div class="upload-hint">Make sure all details are readable.</div>
                <label class="file-input-wrapper" id="aadhaarFrontWrapper" for="aadhaarFront"><span class="file-label" id="aadhaarFrontLabel">Choose front image</span></label>
                <div class="file-meta" id="aadhaarFrontMeta">JPG, PNG or WEBP</div>
                <input class="visually-hidden-file" type="file" id="aadhaarFront" accept="image/jpeg,image/png,image/webp" required>
              </div>
              <div class="upload-card" id="aadhaarBackCard">
                <div class="upload-visual"><div class="upload-placeholder">🪪</div><img class="upload-preview" id="aadhaarBackPreview" alt="Aadhaar back preview"></div>
                <div class="upload-title">Aadhaar back *</div>
                <div class="upload-hint">Make sure all details are readable.</div>
                <label class="file-input-wrapper" id="aadhaarBackWrapper" for="aadhaarBack"><span class="file-label" id="aadhaarBackLabel">Choose back image</span></label>
                <div class="file-meta" id="aadhaarBackMeta">JPG, PNG or WEBP</div>
                <input class="visually-hidden-file" type="file" id="aadhaarBack" accept="image/jpeg,image/png,image/webp" required>
              </div>
            </div>

            <div class="form-group">
              <label for="notes">Additional Notes</label>
              <textarea id="notes" rows="2" placeholder="Any special requests or instructions">${escapeHtml(booking?.notes)}</textarea>
            </div>

            <div class="summary-card">
              <div class="summary-row"><span>Monthly room rent</span><strong id="rentDisplay">₹0 per month</strong></div>
              <div class="summary-row"><span>Rent payment timing</span><strong>Current month, paid in advance after approval</strong></div>
              <div class="summary-row"><span>One-time admission fee</span><strong style="color: var(--primary);" id="feeDisplay">₹${escapeHtml(cheapestOverall)}</strong></div>
            </div>

            <button type="submit" class="btn-submit" id="submitBtn">Pay Admission Fee & Submit</button>
          </form>
          <div class="form-footer">HostelHub · Simple and secure hostel admission</div>
        </div>

        <script>
          // Utility: resize camera images before converting to base64 so mobile
          // submissions do not exceed the server request limit.
          function fileToCompressedBase64(file, maxSize = 1280, quality = 0.72) {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => {
                const image = new Image();
                image.onload = () => {
                  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
                  const canvas = document.createElement('canvas');
                  canvas.width = Math.max(1, Math.round(image.width * scale));
                  canvas.height = Math.max(1, Math.round(image.height * scale));

                  const context = canvas.getContext('2d');
                  if (!context) {
                    reject(new Error('Could not prepare image upload.'));
                    return;
                  }

                  context.drawImage(image, 0, 0, canvas.width, canvas.height);
                  resolve(canvas.toDataURL('image/jpeg', quality));
                };
                image.onerror = reject;
                image.src = reader.result;
              };
              reader.onerror = error => reject(error);
            });
          }

          function onlyDigits(value) {
            return String(value || '').replace(/\\D/g, '').slice(-10);
          }

          const messagePanel = document.getElementById('messagePanel');
          const submitBtn = document.getElementById('submitBtn');
          const overlay = document.getElementById('loadingOverlay');

          function showMessage(type, message) {
            messagePanel.className = 'message-panel ' + type;
            messagePanel.innerText = message;
            messagePanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }

          function clearMessage() {
            messagePanel.className = 'message-panel';
            messagePanel.innerText = '';
          }

          function setSubmitting(isSubmitting, message) {
            submitBtn.disabled = isSubmitting;
            overlay.style.display = isSubmitting ? 'flex' : 'none';
            overlay.innerText = message || 'Processing application, please wait...';
          }

          async function parseResponse(response) {
            const text = await response.text();
            if (!text) return {};
            try {
              return JSON.parse(text);
            } catch (error) {
              return { error: text.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim() };
            }
          }

          function validateBeforeSubmit() {
            const errors = [];
            const requiredFields = [
              ['name', 'Full name is required.'],
              ['address', 'Permanent address is required.'],
              ['guardianName', 'Guardian name is required.'],
              ['nearestPoliceStation', 'Nearest police station is required.'],
              ['occupation', 'Occupation is required.'],
              ['workLocation', 'Work or institution location is required.'],
              ['joiningDate', 'Expected joining date is required.'],
            ];

            requiredFields.forEach(([id, message]) => {
              const value = document.getElementById(id).value.trim();
              if (!value) errors.push(message);
            });

            [
              ['phone', 'Phone number must be exactly 10 digits.'],
              ['whatsappNumber', 'WhatsApp number must be exactly 10 digits.'],
              ['guardianPhone', 'Guardian phone must be exactly 10 digits.'],
            ].forEach(([id, message]) => {
              if (onlyDigits(document.getElementById(id).value).length !== 10) {
                errors.push(message);
              }
            });

            const joiningDate = document.getElementById('joiningDate').value;
            const leavingDate = document.getElementById('leavingDate').value;
            if (joiningDate && leavingDate && leavingDate < joiningDate) {
              errors.push('Expected leaving date cannot be before joining date.');
            }

            [
              ['profilePhoto', 'Profile photo is required.'],
              ['aadhaarFront', 'Aadhaar front image is required.'],
              ['aadhaarBack', 'Aadhaar back image is required.'],
            ].forEach(([id, message]) => {
              const file = document.getElementById(id).files[0];
              if (!file) {
                errors.push(message);
              } else if (!file.type.startsWith('image/')) {
                errors.push(message.replace('is required', 'must be an image'));
              }
            });

            return errors;
          }

          // Update the displayed admission fee to match the selected room type's real pricing.
          // This is for display only — the backend always recomputes the authoritative amount itself.
          const roomFeeMap = ${JSON.stringify(roomFeeMap).replace(/</g, '\\u003c')};
          const roomRentMap = ${JSON.stringify(roomRentMap).replace(/</g, '\\u003c')};
          const cheapestOverallFee = ${JSON.stringify(cheapestOverall)};
          const feeDisplay = document.getElementById('feeDisplay');
          const rentDisplay = document.getElementById('rentDisplay');
          const preferredRoomTypeInput = document.getElementById('preferredRoomType');

          function updateFeeDisplay() {
            const fee = roomFeeMap[preferredRoomTypeInput.value] ?? cheapestOverallFee;
            const rent = roomRentMap[preferredRoomTypeInput.value] ?? 0;
            feeDisplay.innerText = '₹' + fee;
            rentDisplay.innerText = '₹' + rent + ' per month';
          }
          preferredRoomTypeInput.addEventListener('change', updateFeeDisplay);
          updateFeeDisplay();

          // Restrict the joining date picker to at most 7 days in the past (matches server rule),
          // and keep the leaving date picker from going earlier than whatever joining date is chosen.
          const joiningDateInput = document.getElementById('joiningDate');
          const leavingDateInput = document.getElementById('leavingDate');

          const earliestJoining = new Date();
          earliestJoining.setDate(earliestJoining.getDate() - 7);
          joiningDateInput.min = earliestJoining.toISOString().split('T')[0];

          joiningDateInput.addEventListener('change', () => {
            if (joiningDateInput.value) {
              leavingDateInput.min = joiningDateInput.value;
              if (leavingDateInput.value && leavingDateInput.value < joiningDateInput.value) {
                leavingDateInput.value = '';
              }
            }
          });

          // File Label updates
          const fileInputs = [
            { id: 'profilePhoto', wrapperId: 'profileWrapper', cardId: 'profileCard', previewId: 'profilePreview', metaId: 'profileMeta', emptyText: 'Choose photo', selectedText: 'Change photo', emptyMeta: 'JPG, PNG or WEBP' },
            { id: 'aadhaarFront', wrapperId: 'aadhaarFrontWrapper', cardId: 'aadhaarFrontCard', previewId: 'aadhaarFrontPreview', metaId: 'aadhaarFrontMeta', emptyText: 'Choose front image', selectedText: 'Change front image', emptyMeta: 'JPG, PNG or WEBP' },
            { id: 'aadhaarBack', wrapperId: 'aadhaarBackWrapper', cardId: 'aadhaarBackCard', previewId: 'aadhaarBackPreview', metaId: 'aadhaarBackMeta', emptyText: 'Choose back image', selectedText: 'Change back image', emptyMeta: 'JPG, PNG or WEBP' },
          ];
          fileInputs.forEach(({ id, wrapperId, cardId, previewId, metaId, emptyText, selectedText, emptyMeta }) => {
            const el = document.getElementById(id);
            const wrapper = document.getElementById(wrapperId);
            const card = document.getElementById(cardId);
            const preview = document.getElementById(previewId);
            const meta = document.getElementById(metaId);
            const label = document.getElementById(id + 'Label');
            el.addEventListener('change', () => {
              if (el.files && el.files[0]) {
                const file = el.files[0];
                label.textContent = selectedText;
                label.title = file.name;
                meta.textContent = file.name + ' · ' + Math.max(1, Math.round(file.size / 1024)) + ' KB';
                const previewReader = new FileReader();
                previewReader.onload = () => {
                  preview.src = previewReader.result;
                  preview.style.display = 'block';
                  const placeholder = card.querySelector('.upload-placeholder');
                  if (placeholder) placeholder.style.display = 'none';
                };
                previewReader.readAsDataURL(file);
                wrapper.classList.add('selected');
                card.classList.add('has-file');
              } else {
                label.textContent = emptyText;
                label.removeAttribute('title');
                meta.textContent = emptyMeta;
                preview.removeAttribute('src');
                preview.style.display = 'none';
                const placeholder = card.querySelector('.upload-placeholder');
                if (placeholder) placeholder.style.display = 'flex';
                wrapper.classList.remove('selected');
                card.classList.remove('has-file');
              }
            });
          });

          // Form submission
          document.getElementById('admissionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage();

            const validationErrors = validateBeforeSubmit();
            if (validationErrors.length > 0) {
              showMessage('error', 'Please fix these details before submitting:\\n\\n' + validationErrors.map(error => '- ' + error).join('\\n'));
              return;
            }

            setSubmitting(true, 'Preparing documents...');

            try {
              const profilePhotoFile = document.getElementById('profilePhoto').files[0];
              const aadhaarFrontFile = document.getElementById('aadhaarFront').files[0];
              const aadhaarBackFile = document.getElementById('aadhaarBack').files[0];

              const profileBase64 = await fileToCompressedBase64(profilePhotoFile);
              const aadhaarFrontBase64 = await fileToCompressedBase64(aadhaarFrontFile);
              const aadhaarBackBase64 = await fileToCompressedBase64(aadhaarBackFile);

              const payload = {
                name: document.getElementById('name').value,
                phone: onlyDigits(document.getElementById('phone').value),
                whatsappNumber: onlyDigits(document.getElementById('whatsappNumber').value),
                address: document.getElementById('address').value,
                guardianName: document.getElementById('guardianName').value,
                guardianPhone: onlyDigits(document.getElementById('guardianPhone').value),
                nearestPoliceStation: document.getElementById('nearestPoliceStation').value,
                occupation: document.getElementById('occupation').value,
                workLocation: document.getElementById('workLocation').value,
                preferredRoomType: document.getElementById('preferredRoomType').value,
                joiningDate: document.getElementById('joiningDate').value,
                leavingDate: document.getElementById('leavingDate').value || undefined,
                profilePhoto: profileBase64,
                aadhaarFront: aadhaarFrontBase64,
                aadhaarBack: aadhaarBackBase64,
                notes: document.getElementById('notes').value || undefined,
                branchId: ${JSON.stringify(branchId)},
                bookingToken: ${JSON.stringify(booking?.secureToken || undefined)},
                amount: roomFeeMap[preferredRoomTypeInput.value] ?? cheapestOverallFee // Display only; server recomputes the real fee
              };

              let response;
              try {
                setSubmitting(true, 'Submitting application...');
                response = await fetch('/api/admissions/apply', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
              } catch (networkErr) {
                console.error(networkErr);
                showMessage('error', 'Could not reach the server. Please check the internet connection and try again.');
                setSubmitting(false);
                return;
              }

              const result = await parseResponse(response);

              if (response.ok) {
                showMessage('success', 'Application submitted successfully. Opening UPI payment...');
                setSubmitting(true, 'Application saved. Opening UPI payment...');
                setTimeout(() => {
                  window.location.href = result.paymentLink;
                }, 900);
              } else if (Array.isArray(result.details) && result.details.length > 0) {
                const fieldMessages = result.details.map(d => '- ' + (d.field ? d.field + ': ' : '') + d.message).join('\\n');
                showMessage('error', 'Please fix these details:\\n\\n' + fieldMessages);
                setSubmitting(false);
              } else if (response.status === 413) {
                showMessage('error', 'The selected photos are still too large. Please choose smaller or clearer compressed images and submit again.');
                setSubmitting(false);
              } else {
                showMessage('error', 'Submission failed. ' + (result.error || 'Please try again in a moment.'));
                setSubmitting(false);
              }
            } catch (err) {
              console.error(err);
              showMessage('error', 'Could not prepare the selected images. Please use JPG or PNG photos and try again.');
              setSubmitting(false);
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send('<h1>Server error loading apply form</h1>');
  }
});

// 2. GET /pay/:paymentId - Renders the manual UPI payment instruction page
router.get('/pay/:paymentId', async (req: Request, res: Response) => {
  const { paymentId } = req.params;

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        branch: {
          include: {
            user: {
              include: { settings: true },
            },
          },
        },
        tenant: { include: { room: true } },
        admissionApplication: true,
      },
    });

    if (!payment) {
      return res.status(404).send('<h1>Invoice details not found</h1>');
    }

    const settings = payment.branch.user.settings;
    const upiId = settingValue(settings, 'payment_upi_id');
    const receiverName = settingValue(settings, 'payment_receiver_name') || payment.branch.user.name || payment.branch.name;
    const ownerWhatsapp = onlyDigits(settingValue(settings, 'payment_whatsapp_number'));
    const payerName = payment.tenant?.name || payment.admissionApplication?.name || 'Applicant';
    const roomLabel = payment.tenant?.room?.roomNumber ? `Room ${payment.tenant.room.roomNumber}` : 'Admission Application';
    const isRentPayment = payment.paymentType === 'RENT';
    const rentMonthLabel = payment.dueDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const paymentDescription = isRentPayment ? `${rentMonthLabel} advance rent` : 'One-time admission fee';
    const paymentNote = isRentPayment ? `HostelHub advance rent ${rentMonthLabel}` : `HostelHub admission fee ${payment.id}`;
    const upiUrl = upiId
      ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(receiverName)}&am=${encodeURIComponent(String(payment.amount))}&cu=INR&tn=${encodeURIComponent(paymentNote)}`
      : '';
    const whatsappUrl = ownerWhatsapp ? `https://wa.me/91${ownerWhatsapp}` : 'https://wa.me/';

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Manual UPI Payment - HostelHub</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary: #2563EB;
            --primary-dark: #1D4ED8;
            --success: #059669;
            --warning-bg: #FFFBEB;
            --warning-border: #FDE68A;
            --text: #111827;
            --muted: #6B7280;
            --border: #E5E7EB;
          }
          * { box-sizing: border-box; }
          body {
            font-family: 'Outfit', sans-serif;
            background: #F8FAFC;
            padding: 2rem 1rem;
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
          }
          .payment-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
            max-width: 480px;
            width: 100%;
            overflow: hidden;
            border: 1px solid var(--border);
          }
          .header {
            background: #0F172A;
            color: white;
            padding: 1.5rem;
          }
          .header h1 { font-size: 1.2rem; font-weight: 700; margin: 0 0 0.35rem; }
          .header p { margin: 0; color: #CBD5E1; font-size: 0.9rem; }
          .content { padding: 1.5rem; }
          .amount-section {
            text-align: center;
            padding: 1rem;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: #F8FAFC;
            margin-bottom: 1.25rem;
          }
          .amount { font-size: 2.3rem; font-weight: 800; color: var(--primary); }
          .desc { font-size: 0.9rem; color: var(--muted); margin-top: 0.25rem; }
          .detail-row {
            display: flex;
            justify-content: space-between;
            font-size: 0.9rem;
            margin-bottom: 0.75rem;
            gap: 1rem;
          }
          .label { color: var(--muted); }
          .val { font-weight: 700; text-align: right; overflow-wrap: anywhere; }
          .upi-box, .notice {
            border-radius: 10px;
            padding: 1rem;
            margin-top: 1rem;
          }
          .upi-box {
            background: #EFF6FF;
            border: 1px solid #BFDBFE;
          }
          .upi-id {
            font-size: 1.15rem;
            font-weight: 800;
            color: #1E40AF;
            overflow-wrap: anywhere;
          }
          .notice {
            background: var(--warning-bg);
            border: 1px solid var(--warning-border);
            color: #92400E;
            font-size: 0.9rem;
            font-weight: 600;
          }
          .btn {
            border: none;
            width: 100%;
            padding: 1rem;
            font-size: 1rem;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 0.75rem;
            text-decoration: none;
            display: block;
            text-align: center;
          }
          .btn-primary {
            background-color: var(--primary);
            color: white;
          }
          .btn-primary:hover { background-color: var(--primary-dark); }
          .btn-whatsapp {
            background-color: #16A34A;
            color: white;
          }
          .btn-copy {
            background-color: #F1F5F9;
            color: #0F172A;
            border: none;
          }
          .footer {
            background: #F9FAFB;
            padding: 0.75rem;
            text-align: center;
            font-size: 0.75rem;
            color: #9CA3AF;
            border-top: 1px solid var(--border);
          }
          .status { margin-top: 0.75rem; color: var(--success); font-weight: 700; text-align: center; display: none; }
        </style>
      </head>
      <body>
        <div class="payment-card">
          <div class="header">
            <h1>Pay by UPI</h1>
            <p>${escapeHtml(payment.branch.name)}</p>
          </div>
          <div class="content">
            <div class="amount-section">
              <div class="amount">Rs ${escapeHtml(payment.amount)}</div>
              <div class="desc">${escapeHtml(paymentDescription)}</div>
            </div>

            <div class="detail-row">
              <span class="label">Name</span>
              <span class="val">${escapeHtml(payerName)}</span>
            </div>
            <div class="detail-row">
              <span class="label">For</span>
              <span class="val">${escapeHtml(roomLabel)}</span>
            </div>
            ${isRentPayment ? `
              <div class="detail-row">
                <span class="label">Rent month</span>
                <span class="val">${escapeHtml(rentMonthLabel)} (paid in advance)</span>
              </div>
            ` : ''}
            <div class="detail-row">
              <span class="label">Invoice ID</span>
              <span class="val" style="font-size: 0.75rem;">${escapeHtml(payment.id)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Due Date</span>
              <span class="val">${escapeHtml(payment.dueDate.toDateString())}</span>
            </div>

            ${upiId
              ? `
                <div class="upi-box">
                  <div class="label">Pay to UPI ID</div>
                  <div class="upi-id" id="upiId">${escapeHtml(upiId)}</div>
                  <div class="label" style="margin-top: 0.5rem;">Receiver</div>
                  <div class="val" style="text-align: left;">${escapeHtml(receiverName)}</div>
                </div>
                <a class="btn btn-primary" href="${escapeHtml(upiUrl)}">Open UPI App</a>
                <button class="btn btn-copy" type="button" onclick="copyUpi()">Copy UPI ID</button>
              `
              : `
                <div class="notice">
                  UPI ID is not configured yet. Please contact the hostel owner before paying.
                </div>
              `}

            <div class="notice">
              After payment, take a screenshot from your UPI app. Then open WhatsApp below and attach the screenshot in that chat.
            </div>
            <a class="btn btn-whatsapp" href="${escapeHtml(whatsappUrl)}">Share Screenshot on WhatsApp</a>
            <div class="status" id="copyStatus">UPI ID copied.</div>
          </div>
          <div class="footer">
            Owner will verify the screenshot and mark this payment as paid.
          </div>
        </div>

        <script>
          async function copyUpi() {
            const upiId = document.getElementById('upiId')?.innerText || '';
            const status = document.getElementById('copyStatus');
            try {
              await navigator.clipboard.writeText(upiId);
              status.style.display = 'block';
            } catch (error) {
              window.prompt('Copy this UPI ID', upiId);
            }
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send('<h1>Server error loading payment instructions</h1>');
  }
});

export default router;
