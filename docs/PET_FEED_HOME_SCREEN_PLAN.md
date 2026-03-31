# Pet Feed Home Screen – Detailed Implementation Plan

This document outlines the plan for a social feed on the Meropaw home screen, similar to Glassdoor or Ring Neighbors: users see other pets’ memories, photos, videos, or status updates only when owners choose to share publicly. Privacy is per-pet and opt-in.

---

## 1. Overview

### 1.1 Goal
Create a home screen feed where users can browse content shared by other pet owners—photos, videos, memories, and light status updates. Each pet has its own visibility policy; only content marked public appears in the feed.

### 1.2 Key Principles
- **Opt-in sharing** – Nothing appears in the feed unless the owner explicitly makes it public
- **Per-pet policies** – Visibility is controlled per pet, not per user
- **Phased reach** – Start with **global** feed (all public content); add **local** (by location) when user base grows

### 1.3 Content Types in Feed
| Type | Source | Shareable? |
|------|--------|------------|
| Photos / videos | `memories` table | Yes, per memory or per pet policy |
| Pet status | Light text (e.g. "Feeling great!") | Yes, as a status post |
| Pet profile snippet | Name, photo, breed, age (from `pets`) | Yes, if pet is public |
| Health/medical details | health_records, vet info | **No** – never shared |

### 1.4 Engagement: Likes & Comments
- **Likes** – Users can like any feed item (memory or status post); one like per user per item
- **Comments** – Users can add text comments; show count, expand to read/reply
- Increases engagement and community feel; similar to Glassdoor/Ring Neighbors

---

## 2. Visibility Policy (Per Pet)

### 2.1 Policy Levels

| Level | Description | When to Use |
|-------|-------------|-------------|
| **Private** | Pet never appears in feed; no memories shared | Default for new pets |
| **Global** | Pet and selected content appear in global feed (all users) | Launch phase – few pets |
| **Local** | Pet appears only to users in same area (ZIP/region) | Future – when enough users |

### 2.2 Policy Scope (Phase 1 vs Phase 2)

**Phase 1 (Launch)**
- **Global only** – All public pets appear in one feed
- Simpler to implement; works with small user base
- No location filtering

**Phase 2 (Later)**
- **Option: Global or Local** – Owner chooses per pet:
  - **Global** – Same as Phase 1
  - **Local** – Only shown to users in same ZIP / city / radius
- Requires location data (profile address or device location)
- Add when user count justifies local relevance

---

## 3. Database Schema

### 3.1 New Table: `pet_visibility_policies`

Stores per-pet visibility settings.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| pet_id | uuid | FK → pets(id), unique |
| owner_id | uuid | FK → auth, denormalized for RLS |
| visibility | text | `'private'`, `'global'`, `'local'` |
| share_memories | boolean | Include memories in feed (default true if visibility != private) |
| share_status | boolean | Include status posts in feed (default true) |
| local_radius_miles | integer | For `local` – radius in miles (future, default 25) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Unique:** `(pet_id)` – one policy per pet  
**Indexes:** `visibility` (for feed query), `owner_id`

### 3.2 New Table: `feed_posts` (Optional Alternative)

If we want **per-item** control (e.g. some memories public, some not):

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| owner_id | uuid | FK |
| pet_id | uuid | FK → pets |
| source_type | text | `'memory'`, `'status'`, `'milestone'` |
| source_id | uuid | memory.id or null for status |
| content_preview | text | Short text (e.g. status, memory title) |
| media_url | text | Resolved URL for photo/video thumbnail |
| media_type | text | `'photo'`, `'video'`, `'text'` |
| is_public | boolean | Override: include in feed |
| created_at | timestamptz | For ordering |

**Simpler approach (recommended for Phase 1):** Use `pet_visibility_policies` only. If pet is `global` and `share_memories = true`, all non-archived memories appear in feed. No `feed_posts` table – query `memories` + `pets` directly with visibility join.

### 3.3 Add to `memories` Table

| Column | Type | Description |
|--------|------|-------------|
| is_public | boolean | Override: `true` = always share in feed if pet allows; `false` = never share (default null = follow pet policy) |

**Alternative:** Skip `memories.is_public` in Phase 1; all memories of a public pet are shareable. Add per-memory override in Phase 2 if needed.

### 3.4 New Table: `pet_status_posts` (Status Updates)

Lightweight status like "Feeling better!" or "Had a great walk today."

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| owner_id | uuid | FK |
| pet_id | uuid | FK → pets |
| status_text | text | e.g. "Feeling great!" |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Visibility follows pet policy (`share_status` in `pet_visibility_policies`).

### 3.5 New Tables: `feed_likes` and `feed_comments`

**Polymorphic design** – Both memories and status posts can be liked/commented. Use `item_type` + `item_id` to reference either.

**feed_likes**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Who liked |
| item_type | text | `'memory'` or `'status'` |
| item_id | uuid | memories.id or pet_status_posts.id |
| created_at | timestamptz | |

**Unique:** `(user_id, item_type, item_id)` – one like per user per item  
**Indexes:** `(item_type, item_id)` for count/lookup; `user_id` for "liked by me"

**feed_comments**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Who commented |
| item_type | text | `'memory'` or `'status'` |
| item_id | uuid | memories.id or pet_status_posts.id |
| comment_text | text | Max ~500 chars |
| parent_id | uuid | Optional – for replies (Phase 2) |
| created_at | timestamptz | |

**Indexes:** `(item_type, item_id)` for listing comments; `created_at` for order

### 3.6 Migration SQL (Phase 1)

```sql
-- Per-pet visibility policy
create table if not exists pet_visibility_policies (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  owner_id uuid not null,
  visibility text not null default 'private' check (visibility in ('private', 'global', 'local')),
  share_memories boolean default true,
  share_status boolean default true,
  local_radius_miles integer default 25,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (pet_id)
);

create index if not exists idx_pet_visibility_policies_visibility
  on pet_visibility_policies(visibility) where visibility != 'private';
create index if not exists idx_pet_visibility_policies_owner on pet_visibility_policies(owner_id);

alter table pet_visibility_policies enable row level security;

create policy "Users manage their pet visibility policies"
  on pet_visibility_policies for all
  using (auth.uid()::text = owner_id::text)
  with check (auth.uid()::text = owner_id::text);

-- Optional: per-memory override (Phase 1 can skip; add later if needed)
-- alter table memories add column if not exists is_public boolean;

-- Status posts (light text updates)
create table if not exists pet_status_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid not null references pets(id) on delete cascade,
  status_text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_pet_status_posts_pet on pet_status_posts(pet_id);
create index if not exists idx_pet_status_posts_created on pet_status_posts(created_at desc);

alter table pet_status_posts enable row level security;

create policy "Users manage their pet status posts"
  on pet_status_posts for all
  using (auth.uid()::text = owner_id::text)
  with check (auth.uid()::text = owner_id::text);

-- Likes (polymorphic: memory or status post)
create table if not exists feed_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_type text not null check (item_type in ('memory', 'status')),
  item_id uuid not null,
  created_at timestamptz default now(),
  unique (user_id, item_type, item_id)
);

create index if not exists idx_feed_likes_item on feed_likes(item_type, item_id);
create index if not exists idx_feed_likes_user on feed_likes(user_id);

alter table feed_likes enable row level security;

create policy "Users manage their own likes"
  on feed_likes for all
  using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

create policy "Anyone can read likes on public feed items"
  on feed_likes for select
  using (auth.role() = 'authenticated');

-- Comments (polymorphic: memory or status post)
create table if not exists feed_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_type text not null check (item_type in ('memory', 'status')),
  item_id uuid not null,
  comment_text text not null,
  parent_id uuid references feed_comments(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists idx_feed_comments_item on feed_comments(item_type, item_id);
create index if not exists idx_feed_comments_created on feed_comments(created_at);

alter table feed_comments enable row level security;

create policy "Users manage their own comments"
  on feed_comments for all
  using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

create policy "Anyone can read comments on public feed items"
  on feed_comments for select
  using (auth.role() = 'authenticated');
```

---

## 4. Feed Query Logic

### 4.1 Phase 1: Global Feed

**Feed items = memories + status posts** from pets where `visibility = 'global'`.

```
SELECT
  m.id,
  m.owner_id,
  m.pet_id,
  m.media_type,
  m.storage_path,
  m.title,
  m.note,
  m.uploaded_at,
  m.created_at,
  p.name as pet_name,
  p.photos as pet_photos,
  p.breed,
  p.age,
  'memory' as item_type
FROM memories m
JOIN pets p ON p.id = m.pet_id
JOIN pet_visibility_policies pvp ON pvp.pet_id = m.pet_id
WHERE pvp.visibility = 'global'
  AND pvp.share_memories = true
  AND m.is_archived = false
  AND m.owner_id != auth.uid()  -- exclude own content

UNION ALL

SELECT
  s.id,
  s.owner_id,
  s.pet_id,
  'text' as media_type,
  null as storage_path,
  s.status_text as title,
  null as note,
  s.created_at as uploaded_at,
  s.created_at,
  p.name as pet_name,
  p.photos as pet_photos,
  p.breed,
  p.age,
  'status' as item_type
FROM pet_status_posts s
JOIN pets p ON p.id = s.pet_id
JOIN pet_visibility_policies pvp ON pvp.pet_id = s.pet_id
WHERE pvp.visibility = 'global'
  AND pvp.share_status = true
  AND s.owner_id != auth.uid()

ORDER BY uploaded_at DESC
LIMIT 20 OFFSET $offset;
```

### 4.2 Phase 2: Local Feed (Future)

When `visibility = 'local'`:
- Resolve viewer’s location (profile address ZIP or device location)
- Join with owner’s profile (owner_residential_address) or store `pets`/owner location
- Filter: same ZIP, or within `local_radius_miles` of viewer

**Schema addition for Phase 2:**
- Store owner ZIP in `user_profiles` (or derive from address)
- Optional: `pet_visibility_policies.local_radius_miles` for per-pet radius

### 4.3 RLS for Feed

Feed data is **read-only** for other users. We need a policy that lets authenticated users **read** memories and status posts from **other** owners when the pet has `visibility = 'global'`.

Options:
1. **Edge Function** – Feed is fetched via Edge Function (service role); no direct Supabase client reads. Client calls `get-feed` with pagination.
2. **Database function + RLS** – Create a Postgres function `get_feed(limit int, offset int)` that returns a custom type; RLS allows `SELECT` on that function for authenticated users.
3. **View + RLS** – Create a view `public_feed_items` with RLS that allows `SELECT` for `auth.role() = 'authenticated'`.

**Recommended:** Edge Function `get-feed` – gives full control, easier to add local filtering later, and keeps RLS simple on underlying tables.

---

## 5. API Design

### 5.1 Edge Function: `get-feed`

**Request:**
```json
{
  "limit": 20,
  "offset": 0,
  "filter": "global"   // Phase 1: always "global"; Phase 2: "global" | "local"
}
```

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "memory" | "status",
      "pet_id": "uuid",
      "pet_name": "string",
      "pet_photo_url": "string",
      "pet_breed": "string",
      "pet_age": "string",
      "media_type": "photo" | "video" | "text",
      "media_url": "string",
      "title": "string",
      "note": "string",
      "created_at": "ISO8601",
      "like_count": 0,
      "comment_count": 0,
      "liked_by_me": false
    }
  ],
  "has_more": true
}
```

- `media_url`: Resolve `storage_path` to signed URL (Supabase Storage) for memories
- Exclude `owner_id` or anonymize (e.g. "Pet parent") for privacy
- `like_count`, `comment_count`: Aggregated in get-feed or via subqueries
- `liked_by_me`: True if current user has a row in `feed_likes` for this item

### 5.3 Like / Unlike

**Supabase client (direct):** RLS allows users to insert/delete their own likes.

```typescript
// Like
await supabase.from('feed_likes').insert({
  user_id: user.id,
  item_type: 'memory',  // or 'status'
  item_id: itemId
});

// Unlike
await supabase.from('feed_likes').delete()
  .match({ user_id: user.id, item_type: 'memory', item_id: itemId });
```

### 5.4 Add Comment / List Comments

**Add comment:** Supabase insert into `feed_comments`.

```typescript
await supabase.from('feed_comments').insert({
  user_id: user.id,
  item_type: 'memory',
  item_id: itemId,
  comment_text: 'So cute!'
});
```

**List comments:** Query `feed_comments` where `(item_type, item_id)` match, order by `created_at`. Include commenter display name from `user_profiles` (preferred name only; no email).

### 5.5 Client: Set Pet Visibility

**Supabase client (direct):** User updates `pet_visibility_policies` for their pets. RLS allows this.

```typescript
await supabase.from('pet_visibility_policies').upsert({
  pet_id,
  owner_id: user.id,
  visibility: 'global',  // or 'private'
  share_memories: true,
  share_status: true
}, { onConflict: 'pet_id' });
```

---

## 6. UI / UX

### 6.1 Home Screen Feed

| Element | Description |
|---------|-------------|
| Feed list | Vertical scroll of cards (photo/video or status text) |
| Card | Pet name, pet photo thumbnail, content (memory media or status text), timestamp |
| **Like button** | Heart icon; filled when `liked_by_me`, outline when not. Tap toggles like. Show count next to it |
| **Comment button** | Bubble icon + comment count. Tap opens comment sheet/modal |
| Empty state | "No posts yet. Share your pet to see them here!" + CTA to set pet visibility |
| Refresh | Pull-to-refresh |
| Pagination | Infinite scroll (load more on scroll) |

### 6.1a Comments UI

| Element | Description |
|---------|-------------|
| Comment sheet | Bottom sheet or modal; list of comments (commenter name, text, time) |
| Add comment | Text input at bottom; submit adds comment and refreshes list |
| Optional | "X comments" expandable inline under card (e.g. show first 2, "View all X") |

### 6.2 Pet Visibility Settings

Location: Pet profile or Settings → Pet → Visibility

| Control | Options |
|---------|---------|
| Visibility | Private (default) / Global / Local (Phase 2) |
| Share memories | Toggle (on when visibility != private) |
| Share status | Toggle (on when visibility != private) |

### 6.3 Create Status Post

- Entry point: Pet profile or quick "How's [pet] doing?" prompt
- Simple text input, e.g. "Feeling great!", "Just had a vet visit - all good!"
- Saved to `pet_status_posts`; appears in feed if pet is public and `share_status = true`

---

## 7. Implementation Phases

### Phase 1: Global Feed (Launch)

| Step | Task | Order |
|------|------|-------|
| 1.1 | Migration: `pet_visibility_policies`, `pet_status_posts`, `feed_likes`, `feed_comments` | 1 |
| 1.2 | Seed default policy: new pets get `visibility = 'private'` (trigger or app logic) | 2 |
| 1.3 | Edge Function `get-feed` – query global feed, return items with signed URLs, like_count, comment_count, liked_by_me | 3 |
| 1.4 | Client: Home screen feed UI (list, cards, pull-to-refresh, infinite scroll) | 4 |
| 1.5 | Client: Like button + like/unlike logic (optimistic update) | 5 |
| 1.6 | Client: Comment button, comment sheet, add comment, list comments | 6 |
| 1.7 | Client: Pet visibility settings screen (Private / Global toggles) | 7 |
| 1.8 | Client: Create status post UI | 8 |
| 1.9 | Resolve storage paths to signed URLs in get-feed | 9 |

### Phase 2: Local Feed & Options (Later)

| Step | Task |
|------|------|
| 2.1 | Add location to user (ZIP from profile or device) |
| 2.2 | Add `visibility = 'local'` option in policies |
| 2.3 | Extend `get-feed` to filter by viewer location when `filter = 'local'` |
| 2.4 | UI: Let user choose "Show me: Global" or "Show me: Nearby" |
| 2.5 | Per-memory override (`memories.is_public`) if needed |

---

## 8. Files to Create/Modify

### Phase 1

| File | Action |
|------|--------|
| `supabase/migrations/YYYYMMDD_add_pet_feed_schema.sql` | Create – pet_visibility_policies, pet_status_posts, feed_likes, feed_comments |
| `supabase/functions/get-feed/index.ts` | Create – Edge Function for feed (incl. like/comment counts) |
| `src/screens/HomeScreen.tsx` (or equivalent) | Modify – add feed list |
| `src/components/FeedCard.tsx` | Create – feed item card (like + comment buttons) |
| `src/components/CommentSheet.tsx` | Create – comment list + add comment input |
| `src/screens/PetVisibilitySettingsScreen.tsx` | Create – visibility toggles |
| `src/screens/CreateStatusPostScreen.tsx` | Create – or inline in pet profile |
| `src/services/feedService.ts` | Create – get-feed, like/unlike, add/list comments |
| `App.tsx` / router | Add routes for new screens |

---

## 9. Privacy & Safety

| Concern | Mitigation |
|---------|------------|
| Medical data leakage | Never include health_records, vet details, allergies in feed |
| Owner identity | Don’t show owner name/email; use "Pet parent" or omit |
| Content moderation | Plan for report/block; add reporting table in Phase 2 |
| Inappropriate content | Rely on memories (photos/videos) – consider moderation queue later |
| Children/pets in photos | Rely on ToS; no automated filtering in Phase 1 |

---

## 10. Testing Checklist

**Phase 1**
- [ ] New pet gets default `visibility = 'private'`
- [ ] User sets pet to Global → memories/status appear in feed
- [ ] User sets pet to Private → content disappears from feed
- [ ] Feed excludes current user’s own content
- [ ] Feed loads with pagination (limit/offset)
- [ ] Signed URLs for memory media work
- [ ] Status post appears in feed when pet is global
- [ ] Archived memories do not appear in feed
- [ ] Like button toggles; count updates; liked_by_me reflects correctly
- [ ] Comment sheet opens; comments list; add comment works and appears

---

## 11. Summary

| Phase | Scope |
|-------|-------|
| **Phase 1** | Global feed, per-pet visibility (private/global), memories + status posts, **likes + comments**, Edge Function `get-feed` |
| **Phase 2** | Local feed option, visibility = local, location-based filtering |

Start with **global** only. Add **local** when user base and location data justify it. Likes and comments drive engagement from day one.
