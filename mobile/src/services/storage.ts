import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'hostelhub_user_token';
const USER_KEY = 'hostelhub_user_info';

// expo-secure-store has no web implementation, fall back to localStorage there.
const store = Platform.OS === 'web'
  ? {
      setItemAsync: async (key: string, value: string) => {
        localStorage.setItem(key, value);
      },
      getItemAsync: async (key: string) => localStorage.getItem(key),
      deleteItemAsync: async (key: string) => {
        localStorage.removeItem(key);
      },
    }
  : SecureStore;

export async function setToken(token: string): Promise<void> {
  await store.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return await store.getItemAsync(TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  await store.deleteItemAsync(TOKEN_KEY);
}

export async function setUser(user: any): Promise<void> {
  await store.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getUser(): Promise<any | null> {
  const userStr = await store.getItemAsync(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (error) {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await store.deleteItemAsync(TOKEN_KEY);
  await store.deleteItemAsync(USER_KEY);
}
