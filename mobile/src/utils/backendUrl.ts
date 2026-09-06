declare const process: { env: Record<string, string | undefined> };

const SUPABASE_PUBLIC_URL =
  process.env.EXPO_PUBLIC_PUBLIC_FORM_BASE_URL ||
  'https://mraiwlzhvsvwesbzwqgo.supabase.co/functions/v1/hostel-public';
const PUBLIC_PAGES_URL =
  process.env.EXPO_PUBLIC_ADMISSION_PAGES_URL ||
  'https://amildev8547.github.io/Hostel-Management-Application';

export function getBackendBaseUrl(): string {
  return SUPABASE_PUBLIC_URL.replace(/\/$/, '');
}

/**
 * Returns the full public admission form URL for a given branch.
 */
export function getApplyUrl(branchId: string): string {
  return `${PUBLIC_PAGES_URL}/?branchId=${encodeURIComponent(branchId)}`;
}

export function getBookingUrl(secureToken: string): string {
  return `${PUBLIC_PAGES_URL}/?bookingToken=${encodeURIComponent(secureToken)}`;
}

export function getPaymentUrl(paymentId: string): string {
  return `${PUBLIC_PAGES_URL}/payment.html?paymentId=${encodeURIComponent(paymentId)}`;
}
