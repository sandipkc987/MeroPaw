# Onboarding Photos Optimization Plan

## Current Issues to Optimize

1. **Redundant Photo Processing**
   - Photos mapped twice: `payload.photos.map(photo => photo.uri)` then individual processing
   - Memory addition happens in loop, could be batched

2. **Unnecessary Delays**
   - `setTimeout(500)` artificial delay before `completeOnboarding`
   - Could use promises/async properly instead

3. **Error Handling**
   - Memory errors are caught but don't prevent pet creation
   - No rollback if memory addition fails

4. **Code Duplication**
   - Photo URI extraction happens in multiple places
   - Similar logic in `finalizeOnboarding` and `completeOnboarding`

5. **Performance**
   - Sequential memory addition (could be parallel)
   - Multiple state updates could be batched

## Optimization Strategy

### 1. Simplify Photo Processing
- Extract photo URIs once
- Process photos in single pass
- Reduce redundant mappings

### 2. Improve Async Handling
- Use Promise.all for parallel operations where possible
- Remove artificial delays
- Better error propagation

### 3. Better Error Handling
- Continue on memory errors (non-critical)
- Ensure pet is created even if some memories fail
- Log errors clearly

### 4. Code Structure
- Extract helper functions
- Reduce nesting
- Better variable names

### 5. Memory Optimization
- Avoid unnecessary array copies
- Use efficient data structures
- Clean up unused data

