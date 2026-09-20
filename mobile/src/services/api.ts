import axios from 'axios';
import { clearSession, getRefreshToken, getToken, setSession } from './storage';

// Each build supplies its own backend URL. Local development defaults to the
// disposable/local API; production must provide EXPO_PUBLIC_API_BASE_URL.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // Render's free tier can take 30-50s to wake from a cold start, so this
  // needs more headroom than a typical API timeout to avoid false failures.
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshRequest: Promise<string> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(undefined, async (error) => {
  const request = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
  const url = String(request?.url || '');
  const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/refresh');
  if (error.response?.status !== 401 || !request || request._retried || isAuthRoute) throw error;
  request._retried = true;
  try {
    if (!refreshRequest) {
      refreshRequest = (async () => {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw new Error('No refresh session');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        await setSession(response.data.accessToken, response.data.refreshToken, response.data.user);
        return response.data.accessToken as string;
      })().finally(() => { refreshRequest = null; });
    }
    const token = await refreshRequest;
    request.headers.Authorization = `Bearer ${token}`;
    return apiClient.request(request);
  } catch (refreshError) {
    await clearSession();
    sessionExpiredHandler?.();
    throw refreshError;
  }
});

export default apiClient;
