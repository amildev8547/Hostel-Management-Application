# HostelHub Supabase Fresh Setup

Supabase project:

- Project ref: `mraiwlzhvsvwesbzwqgo`
- URL: `https://mraiwlzhvsvwesbzwqgo.supabase.co`
- Region: `ap-southeast-1`

The fresh schema has already been applied to this project. It creates:

- `owner_profile`
- `branches`
- `rooms`
- `admission_applications`
- `tenants`
- `payments`
- `documents`
- `notifications`
- `settings`
- Storage bucket: `tenant-documents`

Mobile app env:

1. Copy `mobile/.env.example` to `mobile/.env`.
2. In Supabase Dashboard, open Project Settings > API.
3. Paste the `anon public` key into `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. Keep `EXPO_PUBLIC_PUBLIC_FORM_BASE_URL` pointed at:
   `https://mraiwlzhvsvwesbzwqgo.functions.supabase.co/hostel-public`

The mobile app now uses Supabase directly for owner-side app data. Tenant admission links are served by the Supabase Edge Function `hostel-public`, so branch sharing and QR codes no longer point to Render.
