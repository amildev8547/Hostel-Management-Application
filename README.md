# HostelHub V1 - Hostel Branch & Occupancy Management System

HostelHub is a single-owner hostel management application for overseeing branches, rooms, admissions, tenants, and manual UPI payments.

This codebase is split into two primary components:
1. **`mobile/`**: A React Native, Expo, and TypeScript mobile client using React Native Paper, React Navigation, React Query, and Supabase.
2. **`supabase/`**: Public Edge Function source for tenant admission links shared from the mobile app.
3. **`backend/`**: Legacy Express/Prisma backend retained for reference only.

---

## Workspace Directory Structure

```text
hostel-management-app/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Legacy Prisma MongoDB schema models
│   │   └── seed.ts             # Legacy DB seeding script
│   ├── src/
│   │   ├── config/             # DB client configurations
  │   │   ├── controllers/        # Route logic handlers (Branch, Rent, etc.)
  │   │   ├── middlewares/        # Single-owner resolver, Zod body/query validation
│   │   ├── routes/             # Express route registers
│   │   ├── services/           # Legacy backend service helpers
│   │   ├── utils/              # Bed occupancy calculators
│   │   └── index.ts            # Core entry point
│   ├── package.json
│   └── tsconfig.json
└── mobile/
    ├── src/
    │   ├── components/         # Reusable layouts (loaders, dialogs)
    │   ├── navigation/         # Tab and Stack router hierarchies
    │   ├── screens/            # UI Views (Dashboard, Profiles, Reviews, Billing)
    │   ├── services/           # Supabase-backed app data access
    │   ├── theme/              # Color indicators & Paper system tokens
    │   └── validations/        # Forms Zod resolvers
    ├── App.tsx
    └── app.json
```

---

## Supabase Environment Configuration (`mobile/.env`)

Configure the following variables in your local `mobile/.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL="https://mraiwlzhvsvwesbzwqgo.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
EXPO_PUBLIC_PUBLIC_FORM_BASE_URL="https://mraiwlzhvsvwesbzwqgo.functions.supabase.co/hostel-public"
```

> [!NOTE]
> Tenant admission links now point to the Supabase Edge Function, not Render.

---

## Database

The app uses Supabase tables for branches, rooms, admissions, tenants, payments, notifications, settings, and tenant document metadata. Tenant uploads are stored in the `tenant-documents` Supabase Storage bucket.

---

## API Documentation & Routes

All API endpoints are prefixed with `/api`.

> [!NOTE]
> This installation is configured for **single-owner mode**. The mobile app opens directly to the dashboard, and protected backend routes automatically use the first owner account in the database. If no owner exists, the backend creates one with `owner@hostelhub.com`.

### 1. Branches
- `GET /branches` - Get all branches (supports `?search=`).
- `POST /branches` - Create branch.
- `GET /branches/:id` - Get branch profile by ID.
- `PUT /branches/:id` - Edit branch.
- `DELETE /branches/:id` - Delete branch.
- `GET /branches/:id/dashboard` - Get detailed occupancy metrics of a branch.

### 2. Rooms
- `GET /rooms?branchId=<id>` - Get rooms belonging to a branch.
- `POST /rooms` - Add room.
- `GET /rooms/:id` - Get room details, occupancy list, and transaction history.
- `PUT /rooms/:id` - Update room parameters.
- `DELETE /rooms/:id` - Delete room (blocks if occupied).

### 3. Admission Applications
- Public form: `/hostel-public/apply/<branchId>` on Supabase Edge Functions.
- Public submission: `/hostel-public/api/admissions/apply`. Saves the application, uploads files to Supabase Storage, creates a pending admission payment, and returns a UPI link.
- `GET /admissions` - View applications list (filters: `?status=PENDING|APPROVED|REJECTED`).
- `GET /admissions/:id` - Retrieve applicant details and file links.
- `POST /admissions/:id/review` - Review application. Body: `{ status: "APPROVED" | "REJECTED", roomId: "<id>" }`. Moves applicant to Tenant directory, releases beds, and updates occupancy.

### 4. Tenant Management
- `GET /tenants` - Get active tenants (filters: `?status=ACTIVE|VACATED`, `?search=`).
- `GET /tenants/:id` - View resident personal profiles, documents, and historical invoices.
- `PUT /tenants/:id` - Edit contact/guardian info.
- `POST /tenants/:id/move` - Reallocate room. Body: `{ newRoomId: "<id>" }`. Recalculates both rooms' statuses.
- `POST /tenants/:id/vacate` - Checks out tenant, releases bed space.
- `DELETE /tenants/:id` - Delete profile.

### 5. Billing & Payments
- `GET /payments` - Retrieve collections (filters: `?status=PAID|PENDING|OVERDUE`, `?branchId=`).
- `POST /payments/generate-dues` - **[OWNER ACTION]** Automatically generates PENDING monthly rent records for all active tenants who do not already have an invoice for the current month.
- `POST /payments/:id/link` - Creates a UPI payment URL for an unpaid invoice.
- Payments are marked paid manually by the owner after verifying cash/UPI receipt or a screenshot shared by the tenant.

---

## Local Testing Guide (Admissions & Payments)

1. Share a branch's apply link from the mobile app.
2. Open the Supabase link in a browser, fill in applicant details, and attach documents.
3. Submit the form. The application appears in the mobile app Admissions tab.
4. The applicant pays through UPI and shares the screenshot manually.
5. The owner verifies the screenshot and marks the payment as paid.

---

## Mobile Application Run Guide

1. Navigate to the `mobile/` directory.
2. Build local modules and launch the Expo server:
   ```bash
   # Start Expo developer tool
   npm start
   ```
3. Use the **Expo Go** application on your Android or iOS device to scan the QR code and load the app, or press `a` to boot on an Android Emulator.

> [!TIP]
> The mobile client reads and writes directly to Supabase. If old data appears on the phone, fully close Expo Go and reload the project.

---

## Deployment Guide

Deploy the Expo app with the Supabase environment variables above. The public tenant form is deployed as the Supabase Edge Function `hostel-public`.
