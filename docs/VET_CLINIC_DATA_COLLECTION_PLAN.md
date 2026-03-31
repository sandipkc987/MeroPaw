# Vet Clinic Data Collection – Detailed Implementation Plan

## Overview
Every time a user searches for vet clinics (by ZIP), we store the returned clinic data in our database. Over time we build an owned dataset that enables instant cache, cost savings, and future features.

---

## 1. Database Schema

### Table: `vet_clinics`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, default gen_random_uuid() |
| name | text | Clinic name |
| address | text | Full street address |
| website | text | Full URL (https://...) |
| phone | text | Phone number |
| zip_code | text | 5-digit ZIP (extracted or passed) |
| city | text | City (optional, parsed from address) |
| state | text | 2-letter state (optional) |
| search_count | integer | How many times this clinic appeared in search results (default 1) |
| last_seen_at | timestamptz | Last time this clinic was returned in a search |
| created_at | timestamptz | First time we saw this clinic |
| updated_at | timestamptz | Last time we updated this row |

### Unique constraint
Use a composite unique key to deduplicate: `(name, address)` or `(name, zip_code, normalized_address)`.
- Simpler: `(name, address)` – same clinic at same address = one row.
- If address formatting varies, consider normalizing (trim, lowercase) before compare.

### Indexes
- `zip_code` – for fast lookup by ZIP
- `last_seen_at` – for cache freshness (e.g. "clinics for 75201 where last_seen_at > 7 days ago")

---

## 2. SQL Migration

```sql
-- vet_clinics: stores clinics returned from vet searches (Gemini)
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

-- Allow read for authenticated users, insert/update from Edge Function via service role
create policy "Authenticated users can read vet clinics"
  on vet_clinics for select
  using (auth.role() = 'authenticated');

create policy "Service role can manage vet clinics"
  on vet_clinics for all
  using (auth.role() = 'service_role');
```

---

## 3. Search Flow (DB-First, Then Gemini)

```
User/client calls find-vets with zipCode
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. Check vet_clinics for zip_code       │
│    WHERE zip_code = $1                  │
│    AND last_seen_at > now() - 7 days    │
│    ORDER BY search_count DESC           │
│    LIMIT $limit                         │
└─────────────────────────────────────────┘
    │
    ├── Found enough results (e.g. >= 5)  ──► Return from DB (instant, no Gemini)
    │
    └── Not enough or none  ──► Call Gemini (find-vets logic)
                                    │
                                    ▼
                              Parse response
                                    │
                                    ▼
                              Insert/upsert into vet_clinics
                                    │
                                    ▼
                              Return results to client
```

---

## 4. Deduplication & Upsert Logic

When saving clinics from Gemini:

1. **Extract ZIP** from the search request (we already have it).
2. **Parse address** (optional) to get city, state if needed.
3. For each clinic in the response:
   - **Try INSERT** with `(name, address)` as unique key.
   - **On conflict** (duplicate): `UPDATE search_count = search_count + 1`, `last_seen_at = now()`, optionally update `website`, `phone` if we have newer data.

```sql
insert into vet_clinics (name, address, website, phone, zip_code, city, state)
values ($1, $2, $3, $4, $5, $6, $7)
on conflict (name, address) do update set
  search_count = vet_clinics.search_count + 1,
  last_seen_at = now(),
  updated_at = now(),
  website = coalesce(excluded.website, vet_clinics.website),
  phone = coalesce(excluded.phone, vet_clinics.phone);
```

---

## 5. Edge Function Changes (find-vets)

### Current flow
1. Receive `zipCode`, `radiusMiles`, `limit`
2. Call Gemini with grounding
3. Parse response
4. Return `{ vets }` to client

### New flow
1. Receive `zipCode`, `radiusMiles`, `limit`
2. **Query `vet_clinics`** for this `zip_code` where `last_seen_at > now() - interval '7 days'`, limit results
3. **If count >= minNeeded (e.g. 5):** return these clinics, skip Gemini
4. **Else:** call Gemini, parse response, **insert/upsert into `vet_clinics`**, return results

### Implementation notes
- Edge Functions use Supabase client with `service_role` key (or `SUPABASE_SERVICE_ROLE_KEY`) to bypass RLS for inserts.
- Need to create Supabase client in the Edge Function: `createClient(supabaseUrl, serviceRoleKey)`.
- Parse address to extract `city`, `state` from full address string (optional; can store empty initially).
- Cache window: 7 days is a reasonable default; make it configurable (env var) if desired.

---

## 6. Step-by-Step Implementation

### Step 6.1: Create migration
- File: `supabase/migrations/YYYYMMDD_add_vet_clinics_table.sql`
- Run: `supabase db push` or run SQL in Supabase Dashboard

### Step 6.2: Add Supabase client to find-vets Edge Function
- Import `createClient` from `@supabase/supabase-js`
- Initialize with `Deno.env.get("SUPABASE_URL")` and `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`

### Step 6.3: Add DB lookup before Gemini
- Query `vet_clinics` where `zip_code = zipCode` and `last_seen_at > now() - interval '7 days'`
- If `rows.length >= 5` (or `limit`): return `{ vets: rows }` and exit

### Step 6.4: Add insert/upsert after Gemini
- After parsing Gemini response, loop over each vet
- Extract city, state from address (simple regex: `, City, ST 12345` pattern)
- Upsert into `vet_clinics` with `on conflict (name, address) do update`

### Step 6.5: Normalize data
- Trim strings, ensure `website` starts with `https://` if present
- Store `zip_code` from request (we know it) rather than parsing from address (avoids parsing errors)

---

## 7. Cache Freshness

| Setting | Value | Rationale |
|---------|-------|-----------|
| Cache window | 7 days | Balance between freshness and Gemini cost; vet info doesn't change daily |
| Min results from DB | 5 | If we have at least 5 recent clinics, consider cache valid |
| Refresh on empty | Always call Gemini | No clinics in DB for this ZIP = call Gemini and populate |

---

## 8. Edge Cases

| Case | Handling |
|------|----------|
| Gemini returns 0 clinics | Don't insert; return empty. No point storing nothing. |
| Duplicate clinic (same name, different address) | Treated as different clinics – unique key is (name, address) |
| Address formatting differs (e.g. "St" vs "Street") | May create duplicates; optional: normalize address before insert |
| RLS / permissions | Edge Function uses service_role; client never writes to vet_clinics directly |
| Client still sends zipCode | Client flow unchanged; all logic is server-side in find-vets |

---

## 9. Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/YYYYMMDD_add_vet_clinics_table.sql` | Create – table, indexes, RLS |
| `supabase/functions/find-vets/index.ts` | Modify – add DB lookup, add upsert after Gemini |
| `supabase/functions/find-vets/` | Ensure `@supabase/supabase-js` is available (Deno import map) |

---

## 10. Environment Variables

Edge Function needs (typically already set for Supabase):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (existing)

---

## 11. Testing Checklist

- [ ] Search for ZIP with no prior data → Gemini called, results returned, DB populated
- [ ] Search same ZIP again within 7 days → Results from DB, no Gemini call
- [ ] Search same ZIP after 7 days → Gemini called again, DB updated
- [ ] Search new ZIP → Gemini called, new rows inserted
- [ ] Same clinic in different searches → Upsert updates `search_count`, `last_seen_at`
- [ ] Gemini returns malformed data → Graceful handling, no crash

---

## 12. Future Enhancements (Optional)

- Add `latitude`, `longitude` for distance sorting
- Add `source` column: 'gemini' vs 'cache'
- Analytics: track which zips are searched most
- Admin UI to view/edit vet_clinics
- Manual refresh: "Refresh results" button that forces Gemini and updates cache
