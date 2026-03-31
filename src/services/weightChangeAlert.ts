import storage from "@src/utils/storage";
import { fetchWeightHistory, insertNotification } from "@src/services/supabaseData";

const SETTINGS_KEY = "@kasper_settings";

export interface WeightAlertSettings {
  weightAlert?: boolean;
  weightThreshold?: number;
}

/**
 * After a new weight is saved, call this to check if we should send a weight-change notification.
 * Reads settings from AsyncStorage; fetches last 2 weights; if change >= threshold, inserts notification.
 */
export async function checkWeightChangeAndNotify(
  userId: string,
  petId: string | undefined
): Promise<void> {
  if (!userId || !petId) return;

  let weightAlert = true;
  let weightThreshold = 5;
  try {
    const stored = await storage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored) as WeightAlertSettings;
      if (settings.weightAlert === false) return;
      if (typeof settings.weightThreshold === "number") weightThreshold = settings.weightThreshold;
    }
  } catch {
    return;
  }

  const history = await fetchWeightHistory(userId, petId);
  if (history.length < 2) return;

  const newest = history[0];
  const previous = history[1];
  const newWeight = Number(newest.weight);
  const prevWeight = Number(previous.weight);
  if (!Number.isFinite(newWeight) || !Number.isFinite(prevWeight) || prevWeight === 0) return;

  const changePct = ((newWeight - prevWeight) / prevWeight) * 100;
  if (Math.abs(changePct) < weightThreshold) return;

  const sign = changePct >= 0 ? "+" : "";
  const message = `Weight changed by ${sign}${changePct.toFixed(1)}% from previous reading.`;

  await insertNotification(userId, {
    petId,
    kind: "health",
    title: "Weight change",
    message,
  });
}
