import axios from 'axios';
import supabaseApiClient from './supabaseApi';

declare const process: { env?: Record<string, string | undefined> };

// Live backend deployed on Render. Used everywhere, including Expo Go/dev
// builds, so admission links and QR codes always point to the live server.
const API_BASE_URL = 'https://hostel-management-application-9xxh.onrender.com/api';

const renderApiClient = axios.create({
  baseURL: API_BASE_URL,
  // Render's free tier can take 30-50s to wake from a cold start, so this
  // needs more headroom than a typical API timeout to avoid false failures.
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Safe cutover switch: Render remains the default and rollback provider. Supabase
// is activated only after schema, data, authentication and workflow parity checks.
const apiClient = process.env?.EXPO_PUBLIC_DATA_PROVIDER === 'supabase'
  ? supabaseApiClient
  : renderApiClient;

export default apiClient;
