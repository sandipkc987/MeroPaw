import { Platform } from "react-native";
import messaging from "@react-native-firebase/messaging";
import storage from "@src/utils/storage";
import { upsertPushToken } from "@src/services/supabaseData";

const DEVICE_ID_KEY = "@kasper_device_id";

const generateDeviceId = () =>
  `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

async function getOrCreateDeviceId() {
  let deviceId = await storage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateDeviceId();
    await storage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

function isPermissionGranted(status: number) {
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

export async function registerPushToken(userId: string) {
  if (Platform.OS === "web") return;
  try {
    await messaging().registerDeviceForRemoteMessages();
    const status = await messaging().requestPermission();
    if (!isPermissionGranted(status)) return;
    const token = await messaging().getToken();
    const deviceId = await getOrCreateDeviceId();
    await upsertPushToken(userId, {
      deviceId,
      token,
      platform: Platform.OS,
    });
  } catch (error) {
    console.warn("Push notifications: registration failed", error);
  }
}

export function subscribeToTokenRefresh(userId: string) {
  if (Platform.OS === "web") return () => {};
  return messaging().onTokenRefresh(async (token) => {
    try {
      const deviceId = await getOrCreateDeviceId();
      await upsertPushToken(userId, {
        deviceId,
        token,
        platform: Platform.OS,
      });
    } catch (error) {
      console.warn("Push notifications: token refresh failed", error);
    }
  });
}

