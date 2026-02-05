# Onboarding Photos Logic - How Profile Pic & Cover Pic Work

## Current Implementation

### How Photos Are Stored

During onboarding, when users upload photos:

1. **Photos are stored in `pet.photos` array** (up to 4 photos)
   - Location: `PetContext` → `Pet` interface → `photos: string[]`
   - Each photo is a URI (local file path)

2. **Photos are also stored as "Memories"**
   - Each photo becomes a `MemoryItem` with:
     - `isFavorite: true` (marked as favorite)
     - `isOnboarding: true` (marked as onboarding photo)
   - Stored in `MemoriesContext`

3. **Photos are NOT stored in User Profile**
   - Why? To prevent `QuotaExceededError` in AsyncStorage
   - Photos are too large to store in AsyncStorage
   - Solution: Store photos in Memories, retrieve from there

### How Profile Pic & Cover Pic Are Determined

**Convention:**
- **Profile Picture** = `pet.photos[0]` (first photo)
- **Cover Picture** = `pet.photos[1]` (second photo, or `pet.photos[0]` if no second photo)

**Code Reference:**
```typescript
// From PetProfileScreen.tsx (lines 63-64)
const profilePhoto = pet?.photos?.[0];
const coverPhoto = pet?.photos?.[1] || pet?.photos?.[0];
```

**ProfileContext Logic:**
```typescript
// From ProfileContext.tsx (lines 114-116)
if (photos?.length) {
  const newAvatarUrl = photos[0] || updated.avatarUrl;  // First photo = avatar
  const newCoverUrl = photos[1] || photos[0] || updated.coverUrl;  // Second photo = cover (or first if no second)
}
```

## Onboarding Flow

### Step-by-Step Process

1. **User Uploads Photos** (OnboardingScreen.tsx)
   - User selects up to 4 photos
   - Photos stored in local state: `photos: OnboardingPhoto[]`

2. **Onboarding Complete** (OnboardingScreen.tsx → finalizeOnboarding)
   ```typescript
   // Step 1: Add pet with photos array
   const petId = await addPet({
     photos: payload.photos.map(photo => photo.uri),  // [uri1, uri2, uri3, uri4]
     // ... other pet data
   });
   
   // Step 2: Add photos as memories
   for (const photo of payload.photos) {
     addMemory({
       src: photo.uri,
       isFavorite: true,
       isOnboarding: true,
       // ... other memory data
     });
   }
   ```

3. **Pet Created** (PetContext.tsx → addPet)
   - Pet stored with `photos: string[]` array
   - First photo = profile pic, second = cover pic

4. **Profile Context Updates** (ProfileContext.tsx)
   - Gets photos from favorite memories
   - Sets `avatarUrl = photos[0]`
   - Sets `coverUrl = photos[1] || photos[0]`

## Current Logic Summary

### Photo Array Structure
```
pet.photos = [
  photo1_uri,  // ← Profile Picture (index 0)
  photo2_uri,  // ← Cover Picture (index 1)
  photo3_uri,  // ← Additional photo (optional)
  photo4_uri   // ← Additional photo (optional)
]
```

### Display Logic
- **Profile Picture**: Always `photos[0]`
- **Cover Picture**: `photos[1]` if exists, otherwise `photos[0]`
- **Additional Photos**: Displayed in photo gallery/memories

### Storage Strategy
- **Pet.photos**: Stored in AsyncStorage (URIs only, limited to 10 photos)
- **Memories**: Stored in AsyncStorage (full photo data as MemoryItem)
- **User Profile**: Does NOT store photos (to prevent quota errors)

## Potential Issues & Considerations

### Current Limitations

1. **No Explicit Profile/Cover Selection**
   - User can't choose which photo is profile vs cover
   - It's automatic: first = profile, second = cover

2. **Order Matters**
   - If user wants a different photo as profile, they need to reorder
   - No UI to "set as profile picture" or "set as cover"

3. **Photo Replacement Logic**
   - When updating profile/cover in ProfileScreen:
     - Profile photo update: `[newPhoto, ...oldPhotos]` (replaces first)
     - Cover photo update: `[oldPhotos[0], newPhoto, ...oldPhotos.slice(2)]` (replaces second)

### Code References

**PetProfileScreen.tsx** (lines 42-60):
```typescript
const handleChangeProfilePhoto = async () => {
  const updated = [uri, ...current.slice(1)];  // New photo at index 0
  await updatePet(pet.id, { photos: updated });
};

const handleChangeCoverPhoto = async () => {
  const profile = current[0];  // Keep first photo as profile
  const updated = [profile || uri, uri, ...current.slice(2)];  // New photo at index 1
  await updatePet(pet.id, { photos: updated });
};
```

## Recommendations

### Option 1: Keep Current Logic (Simple)
- ✅ Simple: First photo = profile, second = cover
- ✅ Works automatically
- ❌ User can't choose which photo is profile/cover

### Option 2: Add Selection UI (Better UX)
- Let users choose which photo is profile picture
- Let users choose which photo is cover picture
- Add "Set as Profile" / "Set as Cover" buttons on photos
- More complex but better UX

### Option 3: Separate Profile/Cover Upload (Most Clear)
- Add explicit "Profile Picture" upload step
- Add explicit "Cover Picture" upload step
- Separate from general photo upload
- Most clear but more steps in onboarding

## Summary

**Current Logic:**
- Profile Pic = `pet.photos[0]` (first uploaded photo)
- Cover Pic = `pet.photos[1]` (second uploaded photo, or first if only one)
- Photos also stored as memories for gallery display
- Photos NOT stored in user profile (prevents quota errors)

**The system works, but users can't explicitly choose which photo is profile vs cover - it's automatic based on upload order.**

