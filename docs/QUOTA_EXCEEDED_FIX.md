# QuotaExceededError Fix

## Problem

`QuotaExceededError` occurred when trying to save user data to AsyncStorage during onboarding. The error happened because full photo URIs (base64 data URLs that can be several MB each) were being stored in `kasper_user` in AsyncStorage.

AsyncStorage has a ~6MB quota limit, and storing 4 high-resolution photos as base64 strings easily exceeds this limit.

## Root Cause

In `AuthContext.completeOnboarding()`, the code was storing:
- `photos: photos` - Array of full photo URIs (base64 strings)
- `photoDetails: profileDetails?.photos` - Array of photo objects with full URIs, titles, and captions

These URIs were then saved in `kasper_user` in AsyncStorage, causing the quota to be exceeded.

## Solution

### Fix 1: Don't Store Full URIs in User Object ✅

**File:** `src/contexts/AuthContext.tsx`

**Changes:**
- Removed `photos` array from `profilePayload` (don't store full URIs)
- Store only metadata in `photoDetails` (titles and captions, but NOT URIs)
- Photos are already stored as memories, so URIs can be retrieved from there

**Code:**
```typescript
// Before:
photos: photos, // Full URIs - exceeds quota
photoDetails: profileDetails?.photos, // Full URIs with metadata

// After:
// Don't store photos array (full URIs) - causes QuotaExceededError
// Photos are already stored as memories, retrieve from there instead
photoDetails: photoDetailsWithoutUris, // Only titles/captions, no URIs
```

### Fix 2: Update ProfileContext to Get Photos from Memories ✅

**File:** `src/contexts/ProfileContext.tsx`

**Changes:**
- Added `useMemories` hook to access memories
- Updated photo extraction logic to get photos from memories instead of `user.profileDetails`
- Fallback to `user.profileDetails` if memories aren't loaded yet (for backward compatibility)
- Added `memories` and `getFavoriteMemories` to dependency array

**Code:**
```typescript
// Get photos from memories instead of user.profileDetails
const favoriteMemories = getFavoriteMemories(4); // Get up to 4 favorite memories
const photosFromMemories: string[] = favoriteMemories.map(m => m.src).filter(Boolean);

// Fallback for backward compatibility
const photosFromProfile: string[] | undefined = details.photos || ...

// Prefer photos from memories
const photos = photosFromMemories.length > 0 ? photosFromMemories : (photosFromProfile || []);
```

## Why This Works

1. **Photos are already stored as memories:** During onboarding, photos are added as memories using `addMemory()`, so they're stored in `@kasper_memories` in AsyncStorage.

2. **Memories storage is separate:** Photos stored as memories don't count against the `kasper_user` quota.

3. **ProfileContext can get photos from memories:** Since photos are stored as memories, ProfileContext can retrieve them from the memories context instead of from `user.profileDetails`.

4. **Backward compatibility:** The fallback to `user.profileDetails` ensures existing code still works if memories aren't loaded yet.

## Expected Behavior

1. **During Onboarding:**
   - Photos are added as memories (stored in `@kasper_memories`)
   - User object is saved WITHOUT full photo URIs (only metadata: titles/captions)
   - No quota error occurs

2. **After Onboarding:**
   - ProfileContext gets photos from memories (favorite memories)
   - Avatar and cover photo are set from favorite memories
   - Photos appear in all screens (Home, Memories, Profile)

3. **Seeding Effect:**
   - MemoriesContext seeding effect won't find URIs in `user.profileDetails` (they're not stored)
   - But this is fine because photos are already in memories from onboarding
   - The seeding effect is a fallback for edge cases, not needed for normal onboarding

## Files Modified

1. `src/contexts/AuthContext.tsx` - Don't store full URIs in user object
2. `src/contexts/ProfileContext.tsx` - Get photos from memories instead of user.profileDetails

## Testing

1. Clear app data
2. Go through onboarding with 4 photos
3. Verify no `QuotaExceededError` occurs
4. Verify photos appear in:
   - HomeScreen (highlights, feed)
   - MemoriesScreen (all photos)
   - ProfileScreen (avatar, cover, gallery)

## Notes

- Photos stored as memories use the `@kasper_memories` AsyncStorage key, which is separate from `kasper_user`
- Only metadata (titles, captions) is stored in `user.profileDetails.photoDetails`
- URIs are retrieved from memories when needed, not stored in the user object
- This fix maintains backward compatibility with existing code


