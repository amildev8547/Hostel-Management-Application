// Supabase is the sole runtime backend. Render/MongoDB are retained only as an
// offline rollback source and are never contacted by the mobile application.
export { default } from './supabaseApi';
