/**
 * Live backend deployed on Render. Used everywhere, including Expo Go/dev
 * builds, so URLs shared to WhatsApp / SMS are always real, live links.
 */
const BACKEND_URL = process.env.EXPO_PUBLIC_PUBLIC_FORM_BASE_URL || 'http://localhost:5000';

export function getBackendBaseUrl(): string {
  return BACKEND_URL;
}

/**
 * Returns the full public admission form URL for a given branch.
 */
export function getApplyUrl(branchId: string): string {
  return `${getBackendBaseUrl()}/apply/${branchId}`;
}
