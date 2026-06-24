import axios from 'axios';
import { getToken, clearSession } from './storage';

// Live backend deployed on Render. Used everywhere, including Expo Go/dev
// builds, so admission links and QR codes always point to the live server.
const API_BASE_URL = 'https://hostel-management-application-9xxh.onrender.com/api';

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
