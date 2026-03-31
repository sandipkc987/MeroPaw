/**
 * Web: FCM is not available via @react-native-firebase/messaging (native-only).
 * Keeping this file separate avoids Metro bundling Firebase native modules for web (fixes web 500 bundle errors).
 */
export async function registerPushToken(_userId: string): Promise<void> {}

export function subscribeToTokenRefresh(_userId: string): () => void {
  return () => {};
}
