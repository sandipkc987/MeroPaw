import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

const hasLocalStorage = (): boolean => {
  try {
    if (!isWeb || typeof window === "undefined" || !window.localStorage) return false;
    const testKey = "__kasper_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

const useLocalStorage = hasLocalStorage();

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (useLocalStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        console.warn("storage.getItem: localStorage failed, falling back to AsyncStorage", e);
      }
    }
    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (useLocalStorage) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (e) {
        console.warn("storage.setItem: localStorage failed, falling back to AsyncStorage", e);
      }
    }
    await AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (useLocalStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        console.warn("storage.removeItem: localStorage failed, falling back to AsyncStorage", e);
        await AsyncStorage.removeItem(key);
      }
      return;
    }
    await AsyncStorage.removeItem(key);
  },

  async multiRemove(keys: string[]): Promise<void> {
    if (useLocalStorage) {
      try {
        keys.forEach((k) => window.localStorage.removeItem(k));
      } catch (e) {
        console.warn("storage.multiRemove: localStorage failed, falling back to AsyncStorage", e);
        await AsyncStorage.multiRemove(keys);
      }
      return;
    }
    await AsyncStorage.multiRemove(keys);
  },
};

export default storage;
