# HostelHub V1 - Hostel Branch & Occupancy Management System

HostelHub is a production-ready multi-branch hostel management application designed exclusively for hostel owners to oversee properties, track room vacancies, automate rent billing, review admission files, and capture Razorpay transaction webhooks.

This codebase is split into two primary components:
1. **`backend/`**: A Node.js, Express, TypeScript, and Prisma backend configured to run with **MongoDB** and **Cloudinary**.
2. **`mobile/`**: A React Native, Expo, and TypeScript mobile client utilizing React Native Paper, React Navigation, and React Query.

---

## Workspace Directory Structure

```text
hostel-management-app/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Prisma MongoDB schema models
│   │   └── seed.ts             # Sandbox DB seeding script
│   ├── src/
│   │   ├── config/             # DB client configurations
│   │   ├── controllers/        # Route logic handlers (Auth, Branch, Rent, etc.)
│   │   ├── middlewares/        # JWT auth, Zod schemas body parsing validation
│   │   ├── routes/             # Express route registers
│   │   ├── services/           # Cloudinary SDK, Razorpay hooks integration
│   │   ├── utils/              # Bed occupancy calculators
│   │   └── index.ts            # Core entry point
│   ├── package.json
│   └── tsconfig.json
└── mobile/
    ├── src/
    │   ├── components/         # Reusable layouts (loaders, dialogs)
    │   ├── navigation/         # Tab and Stack router hierarchies
    │   ├── screens/            # UI Views (Dashboard, Profiles, Reviews, Billing)
    │   ├── services/           # Secure Stores, Axios client configs
    │   ├── theme/              # Color indicators & Paper system tokens
    │   └── validations/        # Forms Zod resolvers
    ├── App.tsx
    └── app.json
```

---

## Backend Environment Configuration (`backend/.env`)

Configure the following variables in your local `backend/.env` file:

```env
PORT=5000
DATABASE_URL="mongodb://localhost:27017/hostelhub" # Local standalone or Atlas connection URL
JWT_SECRET="your-super-secret-jwt-key"

# Cloudinary Storage Configuration
CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"

# Razorpay Checkout Credentials
RAZORPAY_KEY_ID="your-razorpay-key-id"
RAZORPAY_KEY_SECRET="your-razorpay-key-secret"
RAZORPAY_WEBHOOK_SECRET="your-razorpay-webhook-secret"

# Server Host URL
BACKEND_URL="http://localhost:5000"
```

> [!NOTE]
> **Staging Sandbox Fallback**: If the `CLOUDINARY_CLOUD_NAME` is left as `"mock_cloud_name"` or `RAZORPAY_KEY_ID` is left as `"rzp_test_mock_id"`, the backend automatically launches in **Sandbox Mode**. Images will upload to local disk storage (`backend/public/uploads`), and payment links will redirect to a simulated payment portal where you can click "Authorize Mock Payment" to test webhook integrations locally.

---

## Database Initialization & Seeding

1. Ensure a MongoDB instance is running locally or you have connected a MongoDB Atlas URL.
2. In the `backend` folder, run the following commands:
   ```bash
   # Generate Prisma Client Types
   npx prisma generate

   # Sync database indexes and collections
   npx prisma db push

   # Run DB seeding script
   npm run prisma:seed
   ```

*Seeded Account Details:*
- **Owner Account**: `owner@hostelhub.com`
- **Password**: `password123`

---

## API Documentation & Routes

All API endpoints are prefixed with `/api`. Authenticated endpoints require header: `Authorization: Bearer <JWT_TOKEN>`.

### 1. Authentication
- `POST /auth/register` - Register a new owner account.
- `POST /auth/login` - Login to owner account. Returns JWT token and details.
- `POST /auth/forgot-password` - Simulates triggering password recovery link.

### 2. Branches
- `GET /branches` - Get all branches (supports `?search=`).
- `POST /branches` - Create branch.
- `GET /branches/:id` - Get branch profile by ID.
- `PUT /branches/:id` - Edit branch.
- `DELETE /branches/:id` - Delete branch.
- `GET /branches/:id/dashboard` - Get detailed occupancy metrics of a branch.

### 3. Rooms
- `GET /rooms?branchId=<id>` - Get rooms belonging to a branch.
- `POST /rooms` - Add room.
- `GET /rooms/:id` - Get room details, occupancy list, and transaction history.
- `PUT /rooms/:id` - Update room parameters.
- `DELETE /rooms/:id` - Delete room (blocks if occupied).

### 4. Admission Applications
- `POST /admissions/apply` - **[PUBLIC]** Submit application with base64 Profile Photo, Aadhaar Front, and Aadhaar Back. Creates pending rent record and returns Razorpay payment link.
- `GET /admissions` - View applications list (filters: `?status=PENDING|APPROVED|REJECTED`).
- `GET /admissions/:id` - Retrieve applicant details and file links.
- `POST /admissions/:id/review` - Review application. Body: `{ status: "APPROVED" | "REJECTED", roomId: "<id>" }`. Moves applicant to Tenant directory, releases beds, and updates occupancy.

### 5. Tenant Management
- `GET /tenants` - Get active tenants (filters: `?status=ACTIVE|VACATED`, `?search=`).
- `GET /tenants/:id` - View resident personal profiles, documents, and historical invoices.
- `PUT /tenants/:id` - Edit contact/guardian info.
- `POST /tenants/:id/move` - Reallocate room. Body: `{ newRoomId: "<id>" }`. Recalculates both rooms' statuses.
- `POST /tenants/:id/vacate` - Checks out tenant, releases bed space.
- `DELETE /tenants/:id` - Delete profile.

### 6. Billing & Payments
- `GET /payments` - Retrieve collections (filters: `?status=PAID|PENDING|OVERDUE`, `?branchId=`).
- `POST /payments/generate-dues` - **[OWNER ACTION]** Automatically generates PENDING monthly rent records for all active tenants who do not already have an invoice for the current month.
- `POST /payments/:id/link` - Creates a Razorpay checkout URL for an unpaid invoice.
- `POST /payments/:id/reminder` - Generates a WhatsApp reminder template and redirects the owner to WhatsApp.
- `POST /payments/webhook` - **[PUBLIC]** Receives Razorpay webhook payloads (`payment_link.paid`, `payment.captured`), marks records as paid, and releases notifications.
- `GET /payments/simulate-webhook/:paymentId` - **[SANDBOX]** Triggers payment success webhook logic locally for sandbox validation.

---

## Local Testing Guide (Payment Link & Webhooks)

1. Run the backend server: `npm run dev`.
2. Share a branch's apply link: `http://localhost:5000/apply/<branchId>`.
3. Open the link in a browser, fill in the applicant details, upload photos, and click **Pay Admission Fee & Submit**.
4. You will be redirected to the **HostelHub Checkout Sandbox**.
5. Click **Authorize Mock Payment**.
6. The page will trigger the simulated webhook endpoint `/api/payments/simulate-webhook/:paymentId`, update the application status, notify the owner, and redirect you to the success landing page!
7. Open the mobile app (or run API query), log in, and you will see the new application pending review with the admission fee marked as paid!

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
> **API Configuration Note**: The backend endpoint defaults to `http://10.0.2.2:5000/api` on the Android emulator and `http://localhost:5000/api` on iOS. If you are loading the application on a **physical device** (connected to local Wi-Fi), update the base URL in [mobile/src/services/api.ts](file:///c:/Users/AmilDev/Downloads/Hostel%20management%20app/mobile/src/services/api.ts) to match your host computer's local IP address (e.g. `http://192.168.1.X:5000/api`).

---

## Deployment Guide

### Backend Deployment (e.g. Render, AWS, Heroku)
1. Provision a production MongoDB cluster on **MongoDB Atlas** and configure a database user.
2. Create a **Cloudinary** account to copy your Cloud Name, API Key, and API Secret.
3. Configure your production environment variables on your server host corresponding to `.env.example`. Make sure `DATABASE_URL` is set to the Atlas URL.
4. Deploy the Node.js project. Ensure that build commands execute:
   ```bash
   npm install && npx prisma generate && npm run build
   ```
5. Mount your server listener. Register the URL in your Razorpay Webhook Dashboard pointing to `https://your-domain.com/api/payments/webhook`.

### Switching from MongoDB back to PostgreSQL
If you decide to switch from MongoDB to PostgreSQL:
1. In `backend/prisma/schema.prisma`, update the datasource:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Replace all MongoDB ObjectID primary keys:
   ```prisma
   // Replace: id String @id @default(auto()) @map("_id") @db.ObjectId
   // With:
   id String @id @default(uuid())
   ```
3. Remove all `@db.ObjectId` annotations from relation foreign key fields.
4. Run `npx prisma generate` and `npx prisma db push` to initialize the PostgreSQL schema.
