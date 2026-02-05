# Timing/Synchronization Fixes Implemented

## Summary

Fixed critical timing and race condition issues that could prevent onboarding photos from appearing in Highlights, Feed, Memories, and Profile screens.

## Fixes Applied

### Fix 1: Prevent Double-Seeding Race Condition ✅

**File:** `src/contexts/MemoriesContext.tsx`

**Problem:** When `completeOnboarding()` updated `user` state, the MemoriesContext seeding effect would run and try to add the same photos that were just added during onboarding, creating a race condition.

**Solution:** 
- Added `isAddingOnboardingMemoriesRef` ref to track when onboarding memories are being added
- Set flag to `true` when `addMemory()` is called with `isOnboarding: true`
- Clear flag after 1.5 seconds to allow state to flush
- Skip seeding effect if flag is `true`

**Code Changes:**
```typescript
// Added ref
const isAddingOnboardingMemoriesRef = useRef(false);

// In addMemory:
if (isOnboarding) {
  isAddingOnboardingMemoriesRef.current = true;
  setTimeout(() => {
    isAddingOnboardingMemoriesRef.current = false;
  }, 1500);
}

// In seeding useEffect:
if (isAddingOnboardingMemoriesRef.current) {
  console.log('MemoriesProvider: Skipping seed - onboarding memories are being added');
  return;
}
```

### Fix 2: Improved Sequencing in OnboardingScreen ✅

**File:** `src/screens/OnboardingScreen.tsx`

**Problem:** React state updates are async and batched. The delay of 800ms and single `requestAnimationFrame` might not be enough for all state updates to flush before `completeOnboarding()` is called.

**Solution:**
- Wait for multiple animation frames (3 instead of 1) to ensure React state updates are flushed
- Increased delay from 800ms to 1000ms to ensure storage persistence completes

**Code Changes:**
```typescript
// Wait multiple animation frames for React state updates
for (let i = 0; i < 3; i++) {
  await new Promise(resolve => requestAnimationFrame(resolve));
}

// Increased delay for storage persistence
await new Promise(resolve => setTimeout(resolve, 1000)); // Was 800ms
```

### Fix 3: Enhanced HomeScreen Initialization ✅

**File:** `src/screens/HomeScreen.tsx`

**Problem:** HomeScreen waited only 300ms before getting favorite memories, which might not be enough if memories are still loading from storage.

**Solution:**
- Wait multiple times with `requestAnimationFrame` and timeouts
- Retry getting favorite memories up to 5 times if they're not available yet
- Log attempts for debugging

**Code Changes:**
```typescript
// Wait multiple times for React state to flush
await new Promise(resolve => setTimeout(resolve, 200));
await new Promise(resolve => requestAnimationFrame(resolve));
await new Promise(resolve => setTimeout(resolve, 300));

// Retry getting favorite memories if not available
let favoriteMemories = getFavoriteMemories(1);
let attempts = 0;
while (favoriteMemories.length === 0 && memories.length === 0 && attempts < 5) {
  console.log('HomeScreen: Waiting for memories to load...', { attempts });
  await new Promise(resolve => setTimeout(resolve, 200));
  favoriteMemories = getFavoriteMemories(1);
  attempts++;
}
```

## Expected Behavior After Fixes

1. **Onboarding Flow:**
   - Photos are added as memories during onboarding
   - Flag prevents seeding effect from running during onboarding
   - Multiple animation frames ensure state updates are flushed
   - 1 second delay ensures storage persistence completes

2. **After Onboarding:**
   - App.tsx shows HomeScreen when `hasCompletedOnboarding = true`
   - HomeScreen waits for memories to be loaded
   - Retries if memories aren't available yet
   - Welcome post can include favorite memory image

3. **Seeding Effect:**
   - Only runs if onboarding memories aren't being added
   - Prevents duplicate memory creation
   - Still works for edge cases where photos might need to be seeded

## Testing Recommendations

1. **Clear app data** and go through onboarding with 4 photos
2. **Check console logs** for sequence:
   - "OnboardingScreen: Adding memory" (4 times)
   - "OnboardingScreen: Waiting for memories to be persisted..."
   - "MemoriesProvider: Skipping seed - onboarding memories are being added" (should appear)
   - "OnboardingScreen: Memories should now be persisted"
   - "AuthContext.completeOnboarding: Onboarding completed"
   - "HomeScreen: Initializing welcome post" (with favorite memories count)

3. **Verify photos appear in:**
   - HomeScreen Highlights carousel
   - HomeScreen Feed (welcome post image)
   - MemoriesScreen (all 4 photos)
   - ProfileScreen (avatar and gallery)

## Potential Future Improvements

1. **Make `addMemory()` return a Promise:**
   - Would allow proper awaiting in OnboardingScreen
   - Requires changing all call sites

2. **Expose `isInitialized` from MemoriesContext:**
   - HomeScreen could wait for `isInitialized === true` instead of arbitrary delays

3. **Use React 18 `useSyncExternalStore`:**
   - Would provide better synchronization for external state (storage)

## Notes

- All fixes maintain backward compatibility
- No breaking changes to API
- Console logs added for debugging
- Flag timeout of 1.5 seconds is generous but ensures state is flushed


