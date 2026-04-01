import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  registerMyPushTokenApi,
  unregisterMyPushTokenApi,
} from "./userService";

const PUSH_TOKEN_STORAGE_KEY = "EXPO_PUSH_TOKEN_V1";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId() {
  return (
    process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ||
    Constants?.easConfig?.projectId ||
    Constants?.expoConfig?.extra?.eas?.projectId ||
    null
  );
}

function extractNotificationData(response) {
  return (
    response?.notification?.request?.content?.data ||
    response?.request?.content?.data ||
    null
  );
}

function extractNotificationId(response) {
  return (
    response?.notification?.request?.identifier ||
    response?.request?.identifier ||
    null
  );
}

async function ensureAndroidChannelAsync() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Thông báo đơn hàng",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2563EB",
  });
}

async function getExpoPushTokenAsync() {
  const projectId = getProjectId();
  if (projectId) {
    return Notifications.getExpoPushTokenAsync({ projectId });
  }
  return Notifications.getExpoPushTokenAsync();
}

export async function registerDeviceForPushNotificationsAsync(authToken) {
  if (!authToken) {
    return null;
  }

  await ensureAndroidChannelAsync();

  if (!Device.isDevice) {
    return null;
  }

  const currentPermission = await Notifications.getPermissionsAsync();
  let finalStatus = currentPermission?.status;

  if (finalStatus !== "granted") {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission?.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const response = await getExpoPushTokenAsync();
  const expoPushToken = String(response?.data || "").trim();
  if (!expoPushToken) {
    return null;
  }

  await registerMyPushTokenApi(
    {
      token: expoPushToken,
      platform: Platform.OS,
      deviceName: Device.deviceName || "",
      deviceModel: Device.modelName || "",
      appOwnership: String(Constants?.appOwnership || ""),
      projectId: String(getProjectId() || ""),
    },
    authToken,
  );

  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoPushToken);
  return expoPushToken;
}

export async function unregisterStoredPushTokenAsync(authToken) {
  const storedToken = String(
    (await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY)) || "",
  ).trim();

  if (!storedToken) {
    return;
  }

  try {
    if (authToken) {
      await unregisterMyPushTokenApi(storedToken, authToken);
    }
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  }
}

export function addPushNotificationResponseListener(onReceive) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    if (typeof onReceive === "function") {
      onReceive({
        id: extractNotificationId(response),
        data: extractNotificationData(response),
      });
    }
  });
}

export async function getInitialPushNotificationResponseAsync() {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) {
    return null;
  }

  return {
    id: extractNotificationId(response),
    data: extractNotificationData(response),
  };
}