declare const process: {
  env?: Record<string, string | undefined>;
};

const SUPABASE_URL = process.env?.EXPO_PUBLIC_SUPABASE_URL || 'https://mraiwlzhvsvwesbzwqgo.supabase.co';
const PUBLIC_FORM_BASE_URL =
  process.env?.EXPO_PUBLIC_PUBLIC_FORM_BASE_URL ||
  `${SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co')}/hostel-public`;

export function getBackendBaseUrl(): string {
  return PUBLIC_FORM_BASE_URL.replace(/\/$/, '');
}

/**
 * Returns the full public admission form URL for a given branch.
 */
export function getApplyUrl(branchId: string): string {
  return `${getBackendBaseUrl()}/apply/${encodeURIComponent(branchId)}`;
}
