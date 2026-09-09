import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import apiClient from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('hostelhub-important', {
        name: 'HostelHub updates',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F46E5',
      });
    }

    const currentPermission = await Notifications.getPermissionsAsync();
    const permission = currentPermission.status === 'granted'
      ? currentPermission
      : await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await apiClient.post('/notifications/push-token', { token, platform: Platform.OS });
  } catch (error) {
    // Push registration must never prevent the owner from using the app. Expo Go on
    // Android also intentionally rejects remote push registration on recent SDKs.
    console.warn('Push notification registration unavailable:', error);
  }
}
