import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'hostelhub_user_token';
const USER_KEY = 'hostelhub_user_info';
const SEEN_NOTIFICATIONS_KEY = 'hostelhub_seen_notifications';
const HIDDEN_NOTIFICATIONS_KEY = 'hostelhub_hidden_notifications';

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

// Supabase Auth-compatible storage. Kept separate from application data so a
// provider rollback does not destroy either session.
export const supabaseAuthStorage = {
  getItem: (key: string) => store.getItemAsync(key),
  setItem: (key: string, value: string) => store.setItemAsync(key, value),
  removeItem: (key: string) => store.deleteItemAsync(key),
};

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

async function getIdList(key: string): Promise<string[]> {
  try {
    const value = await store.getItemAsync(key);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

async function addIds(key: string, ids: string[]): Promise<void> {
  const existing = await getIdList(key);
  await store.setItemAsync(key, JSON.stringify([...new Set([...existing, ...ids])].slice(-200)));
}

export async function rememberNotificationsSeen(ids: string[]): Promise<void> {
  await addIds(SEEN_NOTIFICATIONS_KEY, ids);
}

export async function rememberNotificationHidden(id: string): Promise<void> {
  await addIds(HIDDEN_NOTIFICATIONS_KEY, [id]);
}

export async function applyLocalNotificationState<T extends { notifications?: any[]; unreadCount?: number }>(data: T): Promise<T> {
  const [seenIds, hiddenIds] = await Promise.all([getIdList(SEEN_NOTIFICATIONS_KEY), getIdList(HIDDEN_NOTIFICATIONS_KEY)]);
  const seen = new Set(seenIds); const hidden = new Set(hiddenIds);
  const notifications = (data.notifications || []).filter((item) => !hidden.has(item.id)).map((item) => seen.has(item.id) ? { ...item, isRead: true } : item);
  return { ...data, notifications, unreadCount: notifications.filter((item) => !item.isRead).length };
}
