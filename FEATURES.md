# HostelHub — Features Document

> **App Name:** HostelHub  
> **Platform:** Mobile App (Android & iOS) + Backend Server  
> **Tech Stack:** React Native (Expo) · Node.js · Express · MongoDB · Razorpay · Cloudinary  

---

## 1. 🔐 Authentication & Account

- **Login** — Owners can log in with email and password
- **Register** — New hostel owners can create an account
- **Forgot Password** — Password reset link via email
- **Change Password** — Update password from the Settings screen
- **Session Management** — Stays logged in using secure JWT tokens (30-day validity)
- **Logout** — Sign out from the app anytime

---

## 2. 📊 Owner Dashboard (Home Screen)

- Total number of **branches, rooms, beds** at a glance
- **Occupied beds** vs **vacant beds** count
- **Occupancy percentage** across all branches
- **Monthly rent collection** — total collected, pending, and overdue amounts
- **Pending admissions** count
- **Recent activities** — latest admission applications, recent payments, and new room allocations

---

## 3. 🏢 Branch Management

- **Add new branches** with name, address, phone, Google Maps location
- **Edit branch** details anytime
- **Delete a branch** (cascading removal of all rooms/tenants/data)
- **Set rent due day** per branch (e.g., rent due on 5th of every month)
- **Activate / Deactivate** a branch
- **Branch Dashboard** — individual branch-level stats including:
  - Total rooms, vacant/partial/full rooms
  - Bed occupancy percentage
  - This month's paid, pending, and overdue payment amounts
  - Recent admissions for that branch
- **Search branches** by name or address

---

## 4. 🚪 Room Management

- **Add rooms** with room number, floor, room type (2 Share, 3 Share, 4 Share, 5 Share, Custom)
- **Set room capacity** — how many people can stay
- **Set monthly rent** and **admission fee** per room
- **Room status tracking** — automatically updates to:
  - `AVAILABLE` (no tenants)
  - `PARTIAL` (some beds occupied)
  - `FULL` (all beds occupied)
  - `MAINTENANCE` (manually set)
- **Edit room** details
- **Delete room** (only if no active tenants)
- **View room details** — see current occupants, vacancy info, and recent payment history

---

## 5. 🧑‍🤝‍🧑 Tenant Management

- **View all tenants** across all branches with search
- **Tenant profile** — full details including:
  - Name, phone, WhatsApp number, permanent address
  - Guardian name & phone
  - Nearest police station
  - Occupation & work location
  - Joining date & leaving date
  - Profile photo, Aadhaar front & back images
  - Current room & branch assignment
  - Complete payment history
- **Edit tenant** details
- **Move tenant** — reallocate a tenant from one room to another
- **Vacate tenant** — mark a tenant as checked out (auto-updates room occupancy)
- **Delete tenant** record permanently
- **Search tenants** by name, phone, or room number
- **Filter tenants** by status (Active / Vacated)

---

## 6. 📝 Online Admission System

- **QR Code Generation** — each branch gets a unique QR code
- **Share admission link** — share the form link via WhatsApp, SMS, etc.
- **Copy admission URL** to clipboard
- **Public Admission Form** (web page) — tenants fill the form themselves on their phone:
  - Personal details (name, phone, WhatsApp)
  - Permanent address
  - Guardian name & phone
  - Nearest police station
  - Occupation & work location
  - Preferred room type
  - Joining & leaving dates
  - Upload profile photo
  - Upload Aadhaar card (front & back)
  - Additional notes
  - Auto-shows correct admission fee based on room type
- **Admission fee auto-calculated** from actual room pricing (server-side)
- **Date validation** — joining date can't be more than 7 days in the past; leaving date must be after joining
- **View all applications** — list with filter by status (Pending / Approved / Rejected) and search
- **Review applications** — owner can approve or reject
- **Approve with room assignment** — select a room when approving, auto-creates a tenant record
- **Reject application** with notification

---

## 7. 💰 Payment & Billing

- **Automatic monthly rent generation** — generate rent invoices for all active tenants in one tap
- **Custom rent invoice** — create prorated invoices for partial stays (e.g., 10 days, 15 days)
- **Discount support** — apply discount amounts on rent invoices
- **Edit payment amount** — adjust pending/overdue invoice amounts
- **Razorpay payment links** — generate online payment links for tenants
- **Simulated payment gateway** — sandbox checkout page for testing without real payments
- **Manual payment recording** — mark an invoice as paid via cash or other methods
- **WhatsApp payment reminder** — generate and send rent reminder messages to tenants
- **Payment status tracking** — PENDING, PAID, OVERDUE
- **Payment types** — RENT and ADMISSION payments
- **Razorpay webhook handling** — automatic payment confirmation when tenant pays online
- **Payment callback page** — success page shown to tenants after payment
- **Payments Dashboard** — view all payments with filters:
  - Filter by branch, status, payment type
  - Filter by month and year
  - Search by tenant name or phone
- **Receipt URLs** generated for paid invoices

---

## 8. 🔔 Notifications & Alerts

- **Notification bell** with unread badge count (updates every 60 seconds)
- **Live alerts** (computed in real-time, no need to create manually):
  - 🔴 **Rent Overdue** — tenants who missed their payment due date
  - 🟡 **Rent Due Today** — tenants whose rent is due today
  - 🟠 **Tenant Vacating Today** — tenants scheduled to leave today
- **Activity notifications** (stored permanently):
  - New admission application received
  - Admission fee paid
  - Rent payment received
  - Admission approved/rejected
  - Tenant vacated
  - Tenant room reallocated
- **Mark as read** — individual or all-at-once
- **Toggle alerts on/off** from Settings

---

## 9. ⚙️ Settings

- **User profile display** — name, email, and role
- **Change password**
- **Auto-generate monthly rent** toggle — turn on/off automatic rent invoice creation
- **Notification alerts** toggle — enable/disable rent due/overdue/vacating alerts
- **System currency** display (₹ Indian Rupee)
- **App version info**
- **Sign out**

---

## 10. 📄 Document Management

- **Profile photo upload** — stored during admission
- **Aadhaar card upload** — front and back images
- **Cloud storage** — files uploaded to Cloudinary (or AWS S3)
- **Local fallback** — if cloud not configured, files stored on server disk
- **Documents linked** to both admission applications and tenant profiles

---

## 11. 🛡️ Security & Validation

- **JWT authentication** — all API endpoints are protected
- **Owner-level data isolation** — each owner only sees their own branches/rooms/tenants
- **Zod validation** — all form inputs validated on the server:
  - Email format check
  - Password minimum 6 characters
  - Phone numbers must be exactly 10 digits
  - Required fields enforced
  - Date format and logic validation
- **Admission fee computed server-side** — prevents clients from manipulating the fee
- **Razorpay webhook signature verification** — ensures payment callbacks are genuine
- **Password hashing** — bcrypt encryption for all stored passwords
- **CORS enabled** — secure cross-origin requests

---

## 12. 🏗️ Technical Architecture

| Component | Technology |
|---|---|
| Mobile App | React Native + Expo |
| UI Library | React Native Paper + Material Icons |
| State Management | React Query (TanStack Query) |
| Backend Server | Node.js + Express + TypeScript |
| Database | MongoDB (via Prisma ORM) |
| Payment Gateway | Razorpay (with sandbox simulator) |
| File Storage | Cloudinary / AWS S3 / Local disk |
| Authentication | JWT + bcrypt |
| Form Validation | Zod |
| QR Code | react-native-qrcode-svg |
| Navigation | React Navigation (Stack + Bottom Tabs) |

---

## 13. 📱 App Navigation Structure

| Tab | What It Shows |
|---|---|
| **Home** | Overall dashboard with key metrics and recent activity |
| **Branches** | List of all hostel branches |
| **Admissions** | All admission applications (Pending / Approved / Rejected) |
| **Tenants** | List of all tenants across branches |
| **Settings** | Account & app preferences |

### Additional Screens (navigated from tabs):
- Branch Dashboard
- Branch Create/Edit Form
- QR Code & Share Link
- Room Details
- Room Create/Edit Form
- Tenant Profile (with payment history & documents)
- Move Tenant (room reallocation)
- Admission Review (approve/reject with room selection)
- Payments Dashboard (with filters)
- Notifications

---

> **Total Screens:** 17 &nbsp;|&nbsp; **Total API Endpoints:** 25+ &nbsp;|&nbsp; **Database Models:** 7
