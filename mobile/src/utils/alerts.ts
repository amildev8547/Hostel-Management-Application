import { Alert } from 'react-native';

// `window.alert` / `window.confirm` don't exist on native React Native — these wrap
// RN's Alert API so the same call works on Android, iOS, and web.

export function showAlert(message: string, title: string = 'Notice', onDismiss?: () => void) {
  Alert.alert(title, message, onDismiss ? [{ text: 'OK', onPress: onDismiss }] : undefined);
}

export function showConfirm(
  message: string,
  onConfirm: () => void,
  options?: { title?: string; confirmText?: string; destructive?: boolean }
) {
  Alert.alert(options?.title ?? 'Please Confirm', message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: options?.confirmText ?? 'OK',
      style: options?.destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}
