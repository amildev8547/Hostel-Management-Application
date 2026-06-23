import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Resolves the backend's root URL using the same dev-server host detection
 * that api.ts uses.  On a physical device connected via Wi-Fi, this returns
 * the host machine's LAN IP (e.g. http://192.168.1.42:5000) so that URLs
 * shared to WhatsApp / SMS are clickable real links — not localhost.
 */
// Live backend deployed on Render. Production builds (and any build without
// a dev server attached) always use this instead of localhost.
const PRODUCTION_BACKEND_URL = 'https://hostel-management-application-9xxh.onrender.com';

export function getBackendBaseUrl(): string {
  if (!__DEV__) {
    return PRODUCTION_BACKEND_URL;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).expoGoConfig?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  const devHost = hostUri ? hostUri.split(':')[0] : null;

  return Platform.select({
    web: 'http://localhost:5000',
    android: `http://${devHost ?? '10.0.2.2'}:5000`,
    ios: `http://${devHost ?? 'localhost'}:5000`,
    default: 'http://localhost:5000',
  }) as string;
}

/**
 * Returns the full public admission form URL for a given branch.
 */
export function getApplyUrl(branchId: string): string {
  return `${getBackendBaseUrl()}/apply/${branchId}`;
}
