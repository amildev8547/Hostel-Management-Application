declare const process: { env?: Record<string, string | undefined> };

const BACKEND_URL = 'https://hostel-management-application-9xxh.onrender.com';
const SUPABASE_PUBLIC_URL =
  process.env?.EXPO_PUBLIC_PUBLIC_FORM_BASE_URL ||
  'https://mraiwlzhvsvwesbzwqgo.supabase.co/functions/v1/hostel-public';
const PUBLIC_PAGES_URL =
  process.env?.EXPO_PUBLIC_ADMISSION_PAGES_URL ||
  'https://amildev8547.github.io/Hostel-Management-Application';

export function getBackendBaseUrl(): string {
  return process.env?.EXPO_PUBLIC_DATA_PROVIDER === 'supabase'
    ? SUPABASE_PUBLIC_URL.replace(/\/$/, '')
    : BACKEND_URL;
}

/**
 * Returns the full public admission form URL for a given branch.
 */
export function getApplyUrl(branchId: string): string {
  return process.env?.EXPO_PUBLIC_DATA_PROVIDER === 'supabase'
    ? `${PUBLIC_PAGES_URL}/?branchId=${encodeURIComponent(branchId)}`
    : `${getBackendBaseUrl()}/apply/${branchId}`;
}

export function getBookingUrl(secureToken: string): string {
  return process.env?.EXPO_PUBLIC_DATA_PROVIDER === 'supabase'
    ? `${PUBLIC_PAGES_URL}/?bookingToken=${encodeURIComponent(secureToken)}`
    : `${getBackendBaseUrl()}/book/${secureToken}`;
}

export function getPaymentUrl(paymentId: string): string {
  return process.env?.EXPO_PUBLIC_DATA_PROVIDER === 'supabase'
    ? `${PUBLIC_PAGES_URL}/payment.html?paymentId=${encodeURIComponent(paymentId)}`
    : `${getBackendBaseUrl()}/pay/${paymentId}`;
}
