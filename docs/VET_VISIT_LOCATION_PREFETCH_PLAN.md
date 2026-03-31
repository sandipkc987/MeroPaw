# Vet Visit Location Pre-fetch – Implementation Plan

## Goal
Pre-fetch vet clinic data before the user reaches the "Discover my vet" step, so results are ready when they need them (no 14–20s wait).

---

## Zip Code Sources (Priority Order)

| Order | Source | When used |
|-------|--------|-----------|
| 1 | **Customer address (profile)** | If user has saved `owner_residential_address` or `owner_mailing_address` in Personal Information, extract ZIP from it |
| 2 | **Device location** | If no address or no ZIP in address → request permission → get lat/lng → reverse geocode to ZIP |
| 3 | **None** | User declined location + no address → no pre-fetch; user enters ZIP manually on Discover step |

---

## Step-by-Step Implementation

### Step 1: Extract ZIP from address (helper)
Create a helper that extracts a US ZIP from a free-text address.

- **Input:** e.g. `"123 Main St, Dallas, TX 75201"` or `"75201"` or `"Dallas TX 75201-1234"`
- **Output:** `"75201"` or `null` if no ZIP found
- **Logic:** Regex `\b(\d{5})(?:-(\d{4}))?\b` – capture 5-digit (optionally +4) ZIP

### Step 2: Fetch user profile address on screen mount
- When `ScheduleVetVisitScreen` mounts (and `user?.id` exists), call `fetchUserProfile(user.id)` or use `useProfile()` to get `ownerResidentialAddress` and `ownerMailingAddress`.
- Try to extract ZIP from both; use first valid ZIP found (e.g. residential first, then mailing).

### Step 3: Pre-fetch when ZIP from address is available
- If a ZIP is extracted from the profile address → call `find-vets` in the background immediately (no location permission needed).
- Store results in `foundVets` state and pre-fill `searchZip` so the Discover step shows results and ZIP without user input.

### Step 4: Location permission flow (when no ZIP from address)
- If no ZIP from profile, request location permission via `expo-location.requestForegroundPermissionsAsync()`.
- If **granted:**  
  1. Call `getCurrentPositionAsync()` to get lat/lng  
  2. Call reverse geocode API (e.g. Google/Mapbox) to get ZIP  
  3. Call `find-vets` with that ZIP in the background
- If **denied:**  
  - Do nothing. User will enter ZIP manually on the Discover step (current behavior).

### Step 5: Reverse geocoding (only when using location)
- Add reverse geocode call: lat/lng → address components (ZIP).
- Options:  
  - Google Maps Geocoding API  
  - Mapbox Geocoding API  
  - Expo’s built-in (if available on platform)
- Parse response for `postal_code` or equivalent.

### Step 6: Pre-fetch function (shared logic)
- Create `prefetchVetsByZip(zip: string)` that:
  1. Sets `searchZip` to the zip
  2. Calls `fetchVetsApi(8)` (or your existing find-vets logic)
  3. Updates `foundVets` with results
  4. Handles errors silently (user can still search manually)

### Step 7: When to trigger pre-fetch
- **Trigger:** As soon as user lands on `ScheduleVetVisitScreen` (or when they tap "Schedule vet visit" and the wizard opens).
- **Flow:**
  1. Check profile for address → extract ZIP → if found, pre-fetch.
  2. If no ZIP from address → request location → if granted, reverse geocode → pre-fetch.
  3. If no ZIP from either → no pre-fetch.

### Step 8: Address updated in profile
- When user updates `owner_residential_address` or `owner_mailing_address` in Personal Information:
  - Profile is saved via `upsertUserProfile`.
  - Next time they open Schedule Vet Visit, the `useEffect` / load logic will use the new address and extract ZIP.
- No extra "refresh on address change" needed for pre-fetch; it uses the latest profile on each screen open.

---

## Fallbacks Summary

| Scenario | What happens |
|----------|--------------|
| User has address with ZIP in profile | Pre-fetch using ZIP from address; no location |
| User has address, no ZIP in address | Request location; if granted → reverse geocode → pre-fetch; if denied → manual ZIP |
| User has no address | Request location; if granted → reverse geocode → pre-fetch; if denied → manual ZIP |
| User declines location | No pre-fetch; user enters ZIP on Discover step (current behavior) |
| Pre-fetch fails (network, API error) | User can still tap "Discover my vet" and search manually |

---

## Files to Touch

| File | Changes |
|------|---------|
| `ScheduleVetVisitScreen.tsx` | Add `useProfile` or `fetchUserProfile`, ZIP extraction, location + reverse geocode, pre-fetch on mount |
| `app.json` (or config) | Add `expo-location` permissions (iOS/Android) if not already present |
| New util (optional) | `utils/geo.ts` – `extractZipFromAddress()`, `reverseGeocode(lat, lng)` |
| `package.json` | `npx expo install expo-location` (if not installed) |

---

## Dependencies
- `expo-location` – permission + `getCurrentPositionAsync`
- Reverse geocode: Google Geocoding or Mapbox (need API key)

---

## Privacy / UX
- Only request location when we don’t have ZIP from address.
- Show brief copy: "Use your location to find nearby vets" (or similar) before requesting.
- If user denies, do not prompt again; rely on manual ZIP.
