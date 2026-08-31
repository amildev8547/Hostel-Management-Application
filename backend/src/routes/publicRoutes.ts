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

// 1. GET /apply/:branchId - Renders the public admission form
router.get('/apply/:branchId', async (req: Request, res: Response) => {
  const { branchId } = req.params;

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
      select: { roomType: true, admissionFee: true },
      orderBy: { admissionFee: 'asc' },
    });
    const roomFeeMap: Record<string, number> = {};
    let cheapestOverall = 1500;
    for (const room of rooms) {
      if (!(room.roomType in roomFeeMap)) {
        roomFeeMap[room.roomType] = room.admissionFee;
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
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary: #4F46E5;
            --primary-hover: #4338CA;
            --background: #F9FAFB;
            --card-bg: #FFFFFF;
            --text-main: #1F2937;
            --text-muted: #6B7280;
            --border: #E5E7EB;
            --success: #10B981;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--background);
            color: var(--text-main);
            line-height: 1.5;
            padding: 2rem 1rem;
          }
          .container {
            max-width: 650px;
            margin: 0 auto;
            background: var(--card-bg);
            border-radius: 16px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02);
            border: 1px solid var(--border);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
            color: white;
            padding: 2.5rem 2rem;
            text-align: center;
          }
          .header h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem; }
          .header p { font-size: 0.95rem; opacity: 0.9; }
          form { padding: 2rem; display: grid; gap: 1.5rem; }
          .section-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--primary);
            border-bottom: 2px solid var(--border);
            padding-bottom: 0.5rem;
            margin-top: 0.5rem;
          }
          .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
          .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
          label { font-size: 0.9rem; font-weight: 600; color: var(--text-main); }
          input, textarea, select {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-family: inherit;
            font-size: 0.95rem;
            transition: all 0.2s;
            outline: none;
          }
          input:focus, textarea:focus, select:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
          }
          .file-input-wrapper {
            background: #F3F4F6;
            border: 2px dashed var(--border);
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
            cursor: pointer;
            position: relative;
          }
          .file-input-wrapper input[type="file"] {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            opacity: 0; cursor: pointer;
          }
          .file-input-wrapper .file-label {
            font-size: 0.85rem; color: var(--text-muted);
          }
          .file-input-wrapper.selected {
            background: #EEF2FF;
            border-color: var(--primary);
          }
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
            background-color: var(--primary);
            color: white;
            border: none;
            padding: 1rem;
            font-size: 1rem;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
            margin-top: 1rem;
          }
          .btn-submit:hover { background-color: var(--primary-hover); }
          .btn-submit:disabled { background-color: var(--text-muted); cursor: not-allowed; }
          @media (max-width: 600px) {
            .form-row { grid-template-columns: 1fr; }
          }
          .loading-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255, 255, 255, 0.8);
            display: none; align-items: center; justify-content: center; text-align: center;
            font-size: 1.2rem; font-weight: 600; z-index: 1000;
            padding: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="loading-overlay" id="loadingOverlay">Processing application, please wait...</div>
        <div class="container">
          <div class="header">
            <h1>Hostel Admission Form</h1>
            <p>${escapeHtml(branch.name)} - Branch Application</p>
          </div>
          <form id="admissionForm">
            <div id="messagePanel" class="message-panel" role="status" aria-live="polite"></div>

            <h2 class="section-title">Personal Details</h2>
            <div class="form-group">
              <label for="name">Full Name *</label>
              <input type="text" id="name" required placeholder="John Doe">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="phone">Phone Number *</label>
                <input type="tel" id="phone" required inputmode="numeric" minlength="10" placeholder="9876543210">
                <span class="help-text">Enter a 10 digit mobile number.</span>
              </div>
              <div class="form-group">
                <label for="whatsappNumber">WhatsApp Number *</label>
                <input type="tel" id="whatsappNumber" required inputmode="numeric" minlength="10" placeholder="9876543210">
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
                <select id="preferredRoomType" required>
                  <option value="2 Share">2 Sharing</option>
                  <option value="3 Share">3 Sharing</option>
                  <option value="4 Share">4 Sharing</option>
                  <option value="5 Share">5 Sharing</option>
                  <option value="Custom">Custom Room</option>
                </select>
              </div>
              <div class="form-group">
                <label for="joiningDate">Expected Joining Date *</label>
                <input type="date" id="joiningDate" required>
              </div>
            </div>
            <div class="form-group">
              <label for="leavingDate">Expected Leaving Date (Optional)</label>
              <input type="date" id="leavingDate">
            </div>

            <h2 class="section-title">Required Documents</h2>
            <div class="form-group">
              <label>Profile Photo *</label>
              <div class="file-input-wrapper" id="profileWrapper">
                <span class="file-label" id="profileLabel">Choose Profile Image</span>
                <input type="file" id="profilePhoto" accept="image/*" required>
              </div>
              <span class="help-text">Use JPG or PNG. Large camera photos will be compressed before upload.</span>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Aadhaar Card Front *</label>
                <div class="file-input-wrapper" id="aadhaarFrontWrapper">
                  <span class="file-label" id="aadhaarFrontLabel">Aadhaar Front Image</span>
                  <input type="file" id="aadhaarFront" accept="image/*" required>
                </div>
                <span class="help-text">Upload a clear front-side image.</span>
              </div>
              <div class="form-group">
                <label>Aadhaar Card Back *</label>
                <div class="file-input-wrapper" id="aadhaarBackWrapper">
                  <span class="file-label" id="aadhaarBackLabel">Aadhaar Back Image</span>
                  <input type="file" id="aadhaarBack" accept="image/*" required>
                </div>
                <span class="help-text">Upload a clear back-side image.</span>
              </div>
            </div>

            <div class="form-group">
              <label for="notes">Additional Notes</label>
              <textarea id="notes" rows="2" placeholder="Any special requests or instructions"></textarea>
            </div>

            <div class="form-group" style="background-color: #F9FAFB; padding: 1rem; border-radius: 8px; border: 1px solid var(--border);">
              <p style="font-size: 0.85rem; color: var(--text-muted); text-align: center;">
                Admission Fee to Pay: <strong style="color: var(--primary); font-size: 1.1rem;" id="feeDisplay">₹${escapeHtml(cheapestOverall)}</strong>
              </p>
            </div>

            <button type="submit" class="btn-submit" id="submitBtn">Pay Admission Fee & Submit</button>
          </form>
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
          const cheapestOverallFee = ${JSON.stringify(cheapestOverall)};
          const feeDisplay = document.getElementById('feeDisplay');
          const preferredRoomTypeInput = document.getElementById('preferredRoomType');

          function updateFeeDisplay() {
            const fee = roomFeeMap[preferredRoomTypeInput.value] ?? cheapestOverallFee;
            feeDisplay.innerText = '₹' + fee;
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
          const fileInputs = ['profilePhoto', 'aadhaarFront', 'aadhaarBack'];
          fileInputs.forEach(id => {
            const el = document.getElementById(id);
            const wrapper = document.getElementById(id + 'Wrapper');
            const label = document.getElementById(id + 'Label');
            el.addEventListener('change', (e) => {
              if (el.files && el.files[0]) {
                label.innerText = el.files[0].name;
                wrapper.classList.add('selected');
              } else {
                label.innerText = 'Choose File';
                wrapper.classList.remove('selected');
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
    const paymentNote = `HostelHub ${payment.paymentType} ${payment.id}`;
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
              <div class="desc">${escapeHtml(payment.paymentType)} payment due</div>
            </div>

            <div class="detail-row">
              <span class="label">Name</span>
              <span class="val">${escapeHtml(payerName)}</span>
            </div>
            <div class="detail-row">
              <span class="label">For</span>
              <span class="val">${escapeHtml(roomLabel)}</span>
            </div>
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
