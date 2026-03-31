/**
 * Geo utilities for location access and address parsing.
 * Uses expo-location (built-in reverse geocode, no external API needed).
 */
import * as Location from "expo-location";

/** Result of getting current position */
export type LocationResult = { lat: number; lng: number };

/**
 * Request foreground location permission.
 * @returns true if granted, false if denied or unavailable
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Check if location permission is already granted.
 */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Get current device position (lat, lng).
 * Requires location permission. Returns null if denied or error.
 */
export async function getCurrentPosition(): Promise<LocationResult | null> {
  try {
    const granted = await requestLocationPermission();
    if (!granted) return null;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = location.coords;
    return { lat: latitude, lng: longitude };
  } catch {
    return null;
  }
}

/**
 * Reverse geocode lat/lng to address components using device services.
 * Returns postalCode (ZIP) if available. Works on device; simulators may return fixed data.
 */
export async function reverseGeocodeToZip(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const first = results?.[0];
    const postalCode = first?.postalCode?.trim();
    if (postalCode && /^\d{5}/.test(postalCode)) {
      return postalCode.slice(0, 5);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get ZIP from current location (permission + position + reverse geocode).
 * One-shot helper for "Use my location" flows.
 */
export async function getZipFromCurrentLocation(): Promise<string | null> {
  const pos = await getCurrentPosition();
  if (!pos) return null;
  return reverseGeocodeToZip(pos.lat, pos.lng);
}

/**
 * Extract US 5-digit ZIP from a free-text address.
 * Handles formats like "123 Main St, Dallas, TX 75201" or "Dallas TX 75201-1234".
 */
export function extractZipFromAddress(address: string | undefined | null): string | null {
  if (!address || typeof address !== "string") return null;
  const match = address.trim().match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}
