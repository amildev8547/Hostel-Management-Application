import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

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
        <title>Hostel Admission Form - ${branch.name}</title>
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
            display: none; align-items: center; justify-content: center;
            font-size: 1.2rem; font-weight: 600; z-index: 1000;
          }
        </style>
      </head>
      <body>
        <div class="loading-overlay" id="loadingOverlay">Processing application, please wait...</div>
        <div class="container">
          <div class="header">
            <h1>Hostel Admission Form</h1>
            <p>${branch.name} - Branch Application</p>
          </div>
          <form id="admissionForm">
            <h2 class="section-title">Personal Details</h2>
            <div class="form-group">
              <label for="name">Full Name *</label>
              <input type="text" id="name" required placeholder="John Doe">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="phone">Phone Number *</label>
                <input type="tel" id="phone" required placeholder="9876543210">
              </div>
              <div class="form-group">
                <label for="whatsappNumber">WhatsApp Number *</label>
                <input type="tel" id="whatsappNumber" required placeholder="9876543210">
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
                <input type="tel" id="guardianPhone" required placeholder="9876543210">
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
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Aadhaar Card Front *</label>
                <div class="file-input-wrapper" id="aadhaarFrontWrapper">
                  <span class="file-label" id="aadhaarFrontLabel">Aadhaar Front Image</span>
                  <input type="file" id="aadhaarFront" accept="image/*" required>
                </div>
              </div>
              <div class="form-group">
                <label>Aadhaar Card Back *</label>
                <div class="file-input-wrapper" id="aadhaarBackWrapper">
                  <span class="file-label" id="aadhaarBackLabel">Aadhaar Back Image</span>
                  <input type="file" id="aadhaarBack" accept="image/*" required>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label for="notes">Additional Notes</label>
              <textarea id="notes" rows="2" placeholder="Any special requests or instructions"></textarea>
            </div>

            <div class="form-group" style="background-color: #F9FAFB; padding: 1rem; border-radius: 8px; border: 1px solid var(--border);">
              <p style="font-size: 0.85rem; color: var(--text-muted); text-align: center;">
                Admission Fee to Pay: <strong style="color: var(--primary); font-size: 1.1rem;" id="feeDisplay">₹${cheapestOverall}</strong>
              </p>
            </div>

            <button type="submit" class="btn-submit" id="submitBtn">Pay Admission Fee & Submit</button>
          </form>
        </div>

        <script>
          // Utility: Convert File to Base64
          function fileToBase64(file) {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve(reader.result);
              reader.onerror = error => reject(error);
            });
          }

          // Update the displayed admission fee to match the selected room type's real pricing.
          // This is for display only — the backend always recomputes the authoritative amount itself.
          const roomFeeMap = ${JSON.stringify(roomFeeMap)};
          const cheapestOverallFee = ${cheapestOverall};
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
            const submitBtn = document.getElementById('submitBtn');
            const overlay = document.getElementById('loadingOverlay');

            submitBtn.disabled = true;
            overlay.style.display = 'flex';

            try {
              const profilePhotoFile = document.getElementById('profilePhoto').files[0];
              const aadhaarFrontFile = document.getElementById('aadhaarFront').files[0];
              const aadhaarBackFile = document.getElementById('aadhaarBack').files[0];

              const profileBase64 = await fileToBase64(profilePhotoFile);
              const aadhaarFrontBase64 = await fileToBase64(aadhaarFrontFile);
              const aadhaarBackBase64 = await fileToBase64(aadhaarBackFile);

              const payload = {
                name: document.getElementById('name').value,
                phone: document.getElementById('phone').value,
                whatsappNumber: document.getElementById('whatsappNumber').value,
                address: document.getElementById('address').value,
                guardianName: document.getElementById('guardianName').value,
                guardianPhone: document.getElementById('guardianPhone').value,
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
                branchId: "${branchId}",
                amount: roomFeeMap[preferredRoomTypeInput.value] ?? cheapestOverallFee // Display only; server recomputes the real fee
              };

              let response;
              try {
                response = await fetch('/api/admissions/apply', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
              } catch (networkErr) {
                console.error(networkErr);
                alert('Could not reach the server. Please check your internet connection and try again.');
                submitBtn.disabled = false;
                overlay.style.display = 'none';
                return;
              }

              const result = await response.json();

              if (response.ok) {
                // Redirect applicant to payment page (Razorpay or simulated portal)
                window.location.href = result.paymentLink;
              } else if (Array.isArray(result.details) && result.details.length > 0) {
                // Validation errors: show exactly which field failed and why.
                const fieldMessages = result.details.map(d => '- ' + d.message).join('\n');
                alert('Please fix the following:\n' + fieldMessages);
                submitBtn.disabled = false;
                overlay.style.display = 'none';
              } else {
                alert('Submission failed: ' + (result.error || 'Unexpected server error. Please try again.'));
                submitBtn.disabled = false;
                overlay.style.display = 'none';
              }
            } catch (err) {
              console.error(err);
              alert('An error occurred while preparing your submission. Please check your files and try again.');
              submitBtn.disabled = false;
              overlay.style.display = 'none';
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

// 2. GET /pay/:paymentId - Renders the Razorpay simulated payment screen
router.get('/pay/:paymentId', async (req: Request, res: Response) => {
  const { paymentId } = req.params;

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { branch: true },
    });

    if (!payment) {
      return res.status(404).send('<h1>Invoice details not found</h1>');
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Razorpay Checkout Simulation</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Outfit', sans-serif;
            background: #F3F4F6;
            padding: 2rem 1rem;
            color: #1F2937;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 90vh;
          }
          .checkout-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            max-width: 420px;
            width: 100%;
            overflow: hidden;
            border: 1px solid #E5E7EB;
          }
          .header {
            background: #0B2545;
            color: white;
            padding: 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header h1 { font-size: 1.1rem; font-weight: 700; margin: 0; }
          .header .logo { font-style: italic; color: #10B981; }
          .content { padding: 1.5rem; }
          .amount-section {
            text-align: center;
            padding: 1rem 0;
            border-bottom: 1px solid #E5E7EB;
            margin-bottom: 1rem;
          }
          .amount { font-size: 2.2rem; font-weight: 700; color: #0B2545; }
          .desc { font-size: 0.9rem; color: #6B7280; }
          .detail-row {
            display: flex;
            justify-content: space-between;
            font-size: 0.9rem;
            margin-bottom: 0.75rem;
          }
          .label { color: #6B7280; }
          .val { font-weight: 600; }
          .sandbox-badge {
            background: #FEF3C7;
            color: #D97706;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            text-align: center;
            margin-bottom: 1rem;
          }
          .btn-pay {
            background-color: #2F69FC;
            color: white;
            border: none;
            width: 100%;
            padding: 1rem;
            font-size: 1rem;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
            margin-top: 1rem;
          }
          .btn-pay:hover { background-color: #174ED4; }
          .btn-pay:disabled { background-color: #9CA3AF; cursor: not-allowed; }
          .footer {
            background: #F9FAFB;
            padding: 0.75rem;
            text-align: center;
            font-size: 0.75rem;
            color: #9CA3AF;
            border-top: 1px solid #E5E7EB;
          }
        </style>
      </head>
      <body>
        <div class="checkout-card">
          <div class="header">
            <h1>HostelHub Checkout</h1>
            <span class="logo">razorpay</span>
          </div>
          <div class="content">
            <div class="sandbox-badge">⚠️ TEST RUN: Sandboxed Integration Simulator</div>
            
            <div class="amount-section">
              <span class="amount">₹${payment.amount}</span>
              <div class="desc">${payment.paymentType} Payment due</div>
            </div>

            <div class="detail-row">
              <span class="label">Branch Name</span>
              <span class="val">${payment.branch.name}</span>
            </div>
            <div class="detail-row">
              <span class="label">Invoice ID</span>
              <span class="val" style="font-size: 0.75rem;">${payment.id}</span>
            </div>
            <div class="detail-row">
              <span class="label">Due Date</span>
              <span class="val">${payment.dueDate.toDateString()}</span>
            </div>

            <button class="btn-pay" id="payBtn" onclick="simulatePayment()">Authorize Mock Payment</button>
          </div>
          <div class="footer">
            Secured by Razorpay • Simulating Webhook Trigger
          </div>
        </div>

        <script>
          async function simulatePayment() {
            const btn = document.getElementById('payBtn');
            btn.disabled = true;
            btn.innerText = 'Authorizing...';

            try {
              const response = await fetch('/api/payments/simulate-webhook/${paymentId}', {
                method: 'POST'
              });
              
              if (response.ok) {
                btn.innerText = 'Payment Authorized!';
                btn.style.backgroundColor = '#10B981';
                setTimeout(() => {
                  window.location.href = '/api/payments/callback';
                }, 1000);
              } else {
                alert('Webhook simulation failed!');
                btn.disabled = false;
                btn.innerText = 'Authorize Mock Payment';
              }
            } catch (err) {
              console.error(err);
              alert('Error triggering payment simulation.');
              btn.disabled = false;
              btn.innerText = 'Authorize Mock Payment';
            }
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send('<h1>Server error loading payment gateway</h1>');
  }
});

export default router;
