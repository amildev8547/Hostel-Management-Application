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

The mobile app now uses Supabase directly for owner-side app data instead of the Render API.
