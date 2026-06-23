import axios from 'axios';
import { getToken, clearSession } from './storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// When running in Expo Go (on an emulator or a physical device over Wi-Fi),
// the dev server's host IP is the same one the phone used to load the JS bundle.
// This lets physical devices reach the backend without hardcoding a LAN IP.
function getDevServerHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).expoGoConfig?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  return hostUri ? hostUri.split(':')[0] : null;
}

const devHost = getDevServerHost();

// On Android Emulator (no devHost available), localhost maps to 10.0.2.2.
// On iOS Simulator / Web, it maps to localhost.
// On a physical device, devHost (the dev server's LAN IP) is used.
const API_BASE_URL = Platform.select({
  web: 'http://localhost:5000/api',
  android: `http://${devHost ?? '10.0.2.2'}:5000/api`,
  ios: `http://${devHost ?? 'localhost'}:5000/api`,
  default: 'http://localhost:5000/api',
});

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token automatically
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle global responses (specifically auth expiration)
export function setupResponseInterceptor(logoutCallback: () => void) {
  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response && error.response.status === 401) {
        console.warn('Session expired. Logging out.');
        await clearSession();
        logoutCallback();
      }
      return Promise.reject(error);
    }
  );
}

export default apiClient;
