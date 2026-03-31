# Schedule Vet Visit – Complete Implementation Plan

This document combines all planned improvements for the Schedule Vet Visit flow: location-based pre-fetch, ZIP extraction from profile, and vet clinic data collection with caching.

---

# PART A: Client-Side Pre-fetch (Location & Profile)

## A.1 Goal
Pre-fetch vet clinic data before the user reaches "Discover my vet" so results are ready when they need them (no 14–20s wait).

## A.2 ZIP Sources (Priority Order)

| Order | Source | When used |
|-------|--------|-----------|
| 1 | **Customer address (profile)** | If `owner_residential_address` or `owner_mailing_address` has a ZIP, extract and use it |
| 2 | **Device location** | No address or no ZIP → request permission → lat/lng → reverse geocode to ZIP |
| 3 | **None** | User declines location + no address → no pre-fetch; user enters ZIP manually |

## A.3 Implementation Steps (Client)

### Step A.3.1: Extract ZIP from address (helper)
- **File:** `src/utils/geo.ts` (new)
- **Function:** `extractZipFromAddress(address: string): string | null`
- **Logic:** Regex `\b(\d{5})(?:-(\d{4}))?\b` – return 5-digit ZIP or null
- **Examples:** `"123 Main St, Dallas, TX 75201"` → `"75201"`; `"Dallas TX 75201-1234"` → `"75201"`

### Step A.3.2: Reverse geocode (lat/lng → ZIP)
- **File:** `src/utils/geo.ts` (new)
- **Function:** `reverseGeocode(lat: number, lng: number): Promise<string | null>`
- **Options:** Google Geocoding API or Mapbox Geocoding API
- **Returns:** 5-digit ZIP from response `postal_code` component

### Step A.3.3: Fetch profile on ScheduleVetVisitScreen mount
- Add `useProfile()` or call `fetchUserProfile(user.id)` when screen mounts
- Read `ownerResidentialAddress`, `ownerMailingAddress`
- Try `extractZipFromAddress()` on both; use first valid ZIP

### Step A.3.4: Pre-fetch when ZIP available from profile
- If ZIP from profile → call `find-vets` in background (via existing `fetchVetsApi`)
- Set `searchZip` and `foundVets` so Discover step shows results immediately
- Handle errors silently (user can still search manually)

### Step A.3.5: Location flow when no ZIP from profile
1. Request permission: `expo-location.requestForegroundPermissionsAsync()`
2. If **granted:** `getCurrentPositionAsync()` → lat/lng → `reverseGeocode()` → call `find-vets` with ZIP
3. If **denied:** no pre-fetch; user enters ZIP manually on Discover step
4. Optional: show brief copy "Use your location to find nearby vets" before requesting

### Step A.3.6: Trigger timing
- **When:** As soon as user lands on `ScheduleVetVisitScreen` (or when wizard opens)
- **Flow:** Check profile → if ZIP, pre-fetch; else request location → if granted, reverse geocode → pre-fetch

## A.4 Fallbacks (Client)

| Scenario | Result |
|----------|--------|
| Profile has address with ZIP | Pre-fetch from address; no location |
| Profile has address, no ZIP | Request location; granted → reverse geocode → pre-fetch; denied → manual |
| No address in profile | Request location; granted → reverse geocode → pre-fetch; denied → manual |
| User declines location | No pre-fetch; manual ZIP on Discover |
| Pre-fetch fails | User taps "Discover my vet" and searches manually |

## A.5 Client Dependencies
- `expo-location` – `npx expo install expo-location`
- Reverse geocode API (Google or Mapbox) – API key required
- `app.json`: iOS `NSLocationWhenInUseUsageDescription`, Android location permissions

## A.6 Client Files to Touch
| File | Changes |
|------|---------|
| `src/utils/geo.ts` | New – `extractZipFromAddress`, `reverseGeocode` |
| `src/screens/ScheduleVetVisitScreen.tsx` | Add `useProfile`, pre-fetch logic, location permission, call pre-fetch on mount |
| `app.json` | Location permission strings |
| `package.json` | `expo-location` dependency |

---

# PART B: Server-Side Vet Clinic Data Collection & Cache

## B.1 Goal
Store vet clinic search results in our database. Use DB as cache for repeat ZIP searches (instant, no Gemini). Build owned dataset over time.

## B.2 Database Schema

### Table: `vet_clinics`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Clinic name |
| address | text | Full street address |
| website | text | Full URL |
| phone | text | Phone number |
| zip_code | text | 5-digit ZIP |
| city | text | Optional, parsed from address |
| state | text | Optional |
| search_count | integer | Times seen in search results |
| last_seen_at | timestamptz | Last time in search |
| created_at | timestamptz | First seen |
| updated_at | timestamptz | Last update |

**Unique:** `(name, address)` for deduplication  
**Indexes:** `zip_code`, `last_seen_at`

## B.3 Search Flow (find-vets Edge Function)

```
Client calls find-vets with zipCode
    │
    ▼
1. Query vet_clinics WHERE zip_code = $1 AND last_seen_at > now() - 7 days
   ORDER BY search_count DESC LIMIT $limit
    │
    ├── Results >= 5  ──► Return from DB (instant, no Gemini)
    │
    └── Fewer or none  ──► Call Gemini
                               │
                               ▼
                         Parse response
                               │
                               ▼
                         Insert/upsert into vet_clinics
                               │
                               ▼
                         Return results
```

## B.4 Upsert Logic
- **Insert** new clinic with `(name, address, website, phone, zip_code, city, state)`
- **On conflict (name, address):** `search_count += 1`, `last_seen_at = now()`, optionally refresh `website`, `phone`

## B.5 Migration SQL

```sql
create table if not exists vet_clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  website text,
  phone text,
  zip_code text not null,
  city text,
  state text,
  search_count integer default 1,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (name, address)
);

create index if not exists idx_vet_clinics_zip_code on vet_clinics(zip_code);
create index if not exists idx_vet_clinics_last_seen on vet_clinics(last_seen_at);

alter table vet_clinics enable row level security;

create policy "Authenticated users can read vet clinics"
  on vet_clinics for select using (auth.role() = 'authenticated');

create policy "Service role can manage vet clinics"
  on vet_clinics for all using (auth.role() = 'service_role');
```

## B.6 find-vets Edge Function Changes
1. Add Supabase client (service role) to access DB
2. Before Gemini: query `vet_clinics` for zip_code, last_seen within 7 days
3. If >= 5 results: return from DB, skip Gemini
4. Else: call Gemini, parse, upsert each clinic, return

## B.7 Server Files to Touch
| File | Changes |
|------|---------|
| `supabase/migrations/YYYYMMDD_add_vet_clinics.sql` | Create table, indexes, RLS |
| `supabase/functions/find-vets/index.ts` | DB lookup before Gemini, upsert after |

---

# PART C: End-to-End Flow (User Journey)

## C.1 User opens Schedule Vet Visit
1. Screen mounts
2. Fetch user profile (owner_residential_address, owner_mailing_address)
3. Extract ZIP from address (if present)
4. If ZIP found → pre-fetch `find-vets` in background (hits Edge Function)
5. If no ZIP → request location permission
6. If granted → get lat/lng → reverse geocode → pre-fetch with ZIP
7. If denied → no pre-fetch

## C.2 Edge Function receives find-vets request
1. Check `vet_clinics` for zip_code, last_seen > 7 days ago
2. If enough results → return from DB (instant)
3. Else → call Gemini, upsert into `vet_clinics`, return

## C.3 User reaches Discover my vet step
- **If pre-fetch ran:** Results already in `foundVets`, `searchZip` pre-filled; no wait
- **If no pre-fetch:** User enters ZIP, taps search; same flow but user-initiated
- **If pre-fetch failed:** User can search manually

## C.4 User updates address in Personal Information
- Profile saved via `upsertUserProfile`
- Next time Schedule Vet Visit opens → new address used for ZIP extraction

---

# PART D: Implementation Order

| Phase | What | Order |
|-------|------|-------|
| 1 | **vet_clinics migration** | Run SQL migration |
| 2 | **find-vets Edge Function** | Add DB lookup + upsert |
| 3 | **Client geo utils** | `extractZipFromAddress`, `reverseGeocode` |
| 4 | **Client pre-fetch** | useProfile, location, pre-fetch on mount |

Recommended: do Part B (server) first so pre-fetch benefits from cache immediately. Then Part A (client).

---

# PART E: Environment & Config

| Item | Required |
|------|----------|
| `expo-location` | Installed |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Edge Function (Supabase default) |
| `GEMINI_API_KEY` | Edge Function (existing) |
| Google Geocoding or Mapbox API key | Client reverse geocode |
| iOS: `NSLocationWhenInUseUsageDescription` | app.json |
| Android: location permissions | app.json |

---

# PART F: Testing Checklist

**Client**
- [ ] Profile has address with ZIP → pre-fetch runs, results shown on Discover
- [ ] Profile has address without ZIP → location requested; granted → pre-fetch; denied → manual
- [ ] No profile address → location requested; granted → pre-fetch; denied → manual
- [ ] Pre-fetch error → user can still search manually

**Server**
- [ ] First search for ZIP → Gemini called, results returned, DB populated
- [ ] Second search same ZIP within 7 days → from DB, no Gemini
- [ ] Search same ZIP after 7 days → Gemini called, DB updated
- [ ] Same clinic in multiple searches → upsert increments search_count
