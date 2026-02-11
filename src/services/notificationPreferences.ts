import storage from "@src/utils/storage";

const SETTINGS_KEY = "@kasper_settings";

export type NotificationPreferences = {
  notifAll: boolean;
  notifReminders: boolean;
  notifHealth: boolean;
  notifPromo: boolean;
};

const defaultPreferences: NotificationPreferences = {
  notifAll: true,
  notifReminders: true,
  notifHealth: true,
  notifPromo: false,
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await storage.getItem(SETTINGS_KEY);
    if (!stored) return { ...defaultPreferences };
    const settings = JSON.parse(stored);
    return {
      notifAll: settings.notifAll ?? defaultPreferences.notifAll,
      notifReminders: settings.notifReminders ?? defaultPreferences.notifReminders,
      notifHealth: settings.notifHealth ?? defaultPreferences.notifHealth,
      notifPromo: settings.notifPromo ?? defaultPreferences.notifPromo,
    };
  } catch (error) {
    console.warn("Notification preferences: failed to load, using defaults", error);
    return { ...defaultPreferences };
  }
}

export async function updateNotificationPreferences(
  updates: Partial<NotificationPreferences>
): Promise<void> {
  try {
    const stored = await storage.getItem(SETTINGS_KEY);
    const settings = stored ? JSON.parse(stored) : {};
    const next = { ...settings, ...updates };
    await storage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Notification preferences: failed to save", error);
  }
}

export function shouldSendNotification(
  kind: string,
  prefs: NotificationPreferences
): boolean {
  if (!prefs.notifAll) return false;
  switch (kind) {
    case "reminder":
      return prefs.notifReminders;
    case "health":
      return prefs.notifHealth;
    case "promo":
      return prefs.notifPromo;
    default:
      return true;
  }
}

