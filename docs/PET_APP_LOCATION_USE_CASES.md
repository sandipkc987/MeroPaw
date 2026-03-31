# Pet App Location Tracking – Use Cases & Data

## Common Use Cases for Pet Apps

### 1. Schedule vet visit (your use case)
- **What:** Use device location when scheduling a vet visit
- **Purpose:** Find nearby vet clinics, prefill clinic address, show distance, enable directions
- **Data collected:** Single lat/lng at the moment the user opens the scheduling flow or searches for vets
- **Storage:** Optional – can be used once for search/display only, or stored on the vet appointment record (clinic address)

### 2. Walk / activity trails
- **What:** Record the route while walking the dog
- **Purpose:** Track distance, duration, map replay, share routes
- **Data collected:** Series of lat/lng points with timestamps (every few seconds during the walk)
- **Storage:** `location_history` table or `LineString` in PostGIS; often many points per walk

### 3. Check-in location for activities
- **What:** Attach “where” to a logged event (vet visit, groomer, park, pet sitter)
- **Purpose:** Remember where things happened, map of places visited
- **Data collected:** One lat/lng per activity/event
- **Storage:** Add `latitude`, `longitude` to activities, vet_appointments, etc.

### 4. Find nearby services
- **What:** Search for vets, groomers, pet stores, parks by proximity
- **Purpose:** Discover options near the user
- **Data collected:** Single lat/lng when user searches
- **Storage:** Usually not stored – used only for the search request

### 5. Lost pet / live sharing
- **What:** Share pet’s or owner’s current location in real time
- **Purpose:** Reunite lost pets, let family see where a walk is
- **Data collected:** Frequent lat/lng updates (every few seconds to minutes)
- **Storage:** Real-time table or external service; often short-lived

### 6. Geofencing (home boundary)
- **What:** Detect when pet/owner enters or leaves a defined area (e.g. home)
- **Purpose:** Alerts for pet escape, arrival home notifications
- **Data collected:** Continuous or periodic location; compare to stored boundary
- **Storage:** Stored boundary (center + radius or polygon); location may not be stored long-term

### 7. Emergency / vet directions
- **What:** One-tap directions from current location to vet clinic
- **Purpose:** Fast navigation in emergencies
- **Data collected:** Current lat/lng passed to maps app (Google/Apple); not typically stored in your DB

### 8. Clinic / business locations
- **What:** Store vet clinic addresses (lat/lng) for display and search
- **Purpose:** Show on map, calculate distance, “closest vet”
- **Data collected:** Address or lat/lng of clinics (entered by you or from an API)
- **Storage:** `vet_clinics` or similar table with address, lat, lng

---

## How Location Tracking Works

### Step 1: Device gets location
- Phone uses **GPS**, **Wi‑Fi**, and **cellular** to estimate position
- Apps call APIs like `expo-location.getCurrentPositionAsync()` or `startLocationUpdatesAsync()`
- Returns: `latitude`, `longitude`, and optionally `accuracy` (meters), `altitude`, `timestamp`

### Step 2: What data is collected
| Field       | Type    | Description                    | Example        |
|------------|---------|--------------------------------|----------------|
| latitude   | number  | Degrees north/south (-90 to 90)| 37.7749        |
| longitude  | number  | Degrees east/west (-180 to 180)| -122.4194      |
| accuracy   | number  | Estimated error in meters      | 10             |
| altitude   | number  | Meters above sea level         | 5 (optional)   |
| timestamp  | ISO str | When the fix was taken         | "2025-03-01T12:00:00Z" |

That’s it. No street name, no personal identity – just coordinates and metadata. You derive address (reverse geocode) or distance to vets from these numbers.

### Step 3: How often
- **One-time:** When user taps “Find nearby vets” or “Use my location” → single request
- **Continuous:** For walks or live tracking → request every N seconds while feature is active

---

## Your Use Case: Schedule Vet Visit

### Goal
When scheduling a vet visit, use location to:
1. Find vets near the user
2. Show distance to each clinic
3. Prefill or suggest clinic address
4. Enable “Directions” from current location to the clinic

### What you actually need

1. **User location (one-time)**
   - Get current lat/lng when user taps “Find nearby vets” or opens the vet visit flow
   - No need for background or continuous tracking

2. **Vet clinic locations**
   - Store lat/lng for each clinic (from address or geocoding)
   - Use for distance calculation and map display

3. **Optional: Store location on the appointment**
   - Save the clinic’s lat/lng (or address) on the vet_appointments row
   - Lets you show “Where we went” later; user’s device location usually isn’t stored here

### Flow
1. User opens “Schedule vet visit”
2. App asks for location permission (one-time)
3. App calls `getCurrentPositionAsync()` → receives lat, lng
4. App queries clinics (your DB or external API) and sorts/filters by distance from (lat, lng)
5. User picks a clinic
6. You save clinic address/lat/lng on the appointment
7. “Directions” opens the maps app with origin = current location, destination = clinic address

### Data collected for vet scheduling
- **One lat/lng** when the user searches or uses “Use my location”
- **Clinic lat/lng** (already in your data)
- No ongoing tracking; no location history beyond what you explicitly store
