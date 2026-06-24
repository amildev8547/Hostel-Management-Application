/**
 * Live backend deployed on Render. Used everywhere, including Expo Go/dev
 * builds, so URLs shared to WhatsApp / SMS are always real, live links.
 */
const BACKEND_URL = 'https://hostel-management-application-9xxh.onrender.com';

export function getBackendBaseUrl(): string {
  return BACKEND_URL;
}

/**
 * Returns the full public admission form URL for a given branch.
 */
export function getApplyUrl(branchId: string): string {
  return `${getBackendBaseUrl()}/apply/${branchId}`;
}
