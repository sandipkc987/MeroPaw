# Timing/Synchronization Issues Analysis

## Issues Identified

### Issue 1: React State Updates Are Asynchronous

**Problem:**
- `addMemory()` in OnboardingScreen calls `setMemories()` which is async
- The state update might not be flushed before `completeOnboarding()` is called
- The 800ms delay helps but React state updates are batched and might not be ready

**Current Code:**
```typescript
addMemory(...); // State update happens async
memoryPromises.push(new Promise(resolve => setTimeout(resolve, 50)));
await Promise.all(memoryPromises); // Only waits for setTimeout, not state updates
await new Promise(resolve => setTimeout(resolve, 800)); // Hopeful delay
await completeOnboarding(...); // Might run before memories are in state
```

### Issue 2: Context Effects Race Condition

**Problem:**
- When `completeOnboarding()` updates `user` state, it triggers useEffects in:
  - MemoriesContext (seeding photos from profile)
  - ProfileContext (syncing profile data)
  - PetContext (creating default pet)
- These effects might run BEFORE the memories added in OnboardingScreen are fully in state
- The seeding effect might try to add the same photos again or miss existing memories

**Flow:**
1. OnboardingScreen calls `addMemory()` 4 times → triggers `setMemories()` (async)
2. OnboardingScreen calls `completeOnboarding()` → triggers `setUser()` (async)
3. App.tsx sees `hasCompletedOnboarding = true` → shows HomeScreen
4. MemoriesContext useEffect sees new `user` → tries to seed photos
5. But memories from step 1 might not be in state yet!

### Issue 3: Storage Persistence Timing

**Problem:**
- `addMemory()` persists to storage but doesn't await it (fire-and-forget)
- `completeOnboarding()` persists user data
- If HomeScreen renders before storage is persisted, it might not find memories

### Issue 4: HomeScreen Initialization Timing

**Problem:**
- HomeScreen waits 300ms before getting favorite memories
- But if MemoriesContext hasn't finished loading memories from storage yet, it might get empty results

## Recommended Fixes

### Fix 1: Make addMemory Return a Promise

Make `addMemory()` return a Promise that resolves when state is updated and persisted:

```typescript
const addMemory = useCallback((
  memory: Omit<MemoryItem, ...>,
  options?: { isFavorite?: boolean; isOnboarding?: boolean }
): Promise<void> => {
  return new Promise((resolve) => {
    const newMemory = { ... };
    setMemories(prev => {
      const updated = [newMemory, ...prev];
      // Persist and resolve when done
      storage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(updated))
        .then(() => {
          resolve();
        })
        .catch(() => {
          resolve(); // Still resolve on error
        });
      return updated;
    });
  });
}, []);
```

### Fix 2: Await Memory Additions in OnboardingScreen

```typescript
const memoryPromises = payload.photos.map(async (photo) => {
  await addMemory({...}, { isFavorite: true, isOnboarding: true });
});

await Promise.all(memoryPromises);
```

### Fix 3: Add a Flag to Prevent Double-Seeding

In MemoriesContext, check if memories are already being added by OnboardingScreen:

```typescript
const isAddingMemoriesRef = useRef(false);

// In addMemory:
isAddingMemoriesRef.current = true;
// ... add memory
setTimeout(() => { isAddingMemoriesRef.current = false; }, 100);

// In seeding useEffect:
if (isAddingMemoriesRef.current) {
  console.log('MemoriesProvider: Skipping seed - memories being added');
  return;
}
```

### Fix 4: Increase HomeScreen Wait Time and Check if Memories Are Loaded

```typescript
// Wait for MemoriesContext to be initialized
let attempts = 0;
while (!isInitialized && attempts < 10) {
  await new Promise(resolve => setTimeout(resolve, 100));
  attempts++;
}
```

### Fix 5: Use requestIdleCallback or flushSync for Critical Updates

For critical state updates, we could use `flushSync` from React to force synchronous updates:

```typescript
import { flushSync } from 'react-dom'; // React Native doesn't have this
```

But React Native doesn't support `flushSync`. Alternative: Use a callback pattern.


