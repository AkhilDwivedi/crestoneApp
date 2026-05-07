import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulator/web
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4AF55',
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResp.data;
    if (token) {
      try {
        await api.post('/auth/push-token', { expo_push_token: token });
      } catch (e) {
        // ignore — backend may still be reachable later
      }
    }
    return token;
  } catch {
    return null;
  }
}
