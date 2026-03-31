# Highlights Carousel – Right Edge Cutoff (iOS) – Root Cause Analysis

## What you wanted
- Full-width slides with no peek of adjacent slides
- No right-edge cutoff on iOS

## Current implementation

```ts
// HighlightsCarousel.tsx
const { width: screenWidth } = useWindowDimensions();
contentPaddingH = isTablet ? SPACING.lg (16) : SPACING.md (12);
slideWidth = screenWidth - (contentPaddingH * 2);

// FlatList:
contentContainerStyle={{ paddingHorizontal: contentPaddingH }}
snapToInterval={slideWidth}
pagingEnabled
```

- Each slide is `screenWidth - 24` (phone) or `screenWidth - 32` (tablet)
- FlatList content has `paddingHorizontal: 12` (phone)
- Sliding math uses `slideWidth` for scroll offset

---

## Root causes (likely culprits)

### 1. `useWindowDimensions` vs actual layout width (most likely)

- `useWindowDimensions().width` returns full window width.
- On iOS, the real content width can be smaller due to:
  - Safe area insets
  - Parent padding
  - Split view, slide-over, multitasking
- HighlightsCarousel uses `screenWidth` for `slideWidth`, but the FlatList is inside a ScrollView and other parents. Its actual rendered width can differ.

**Result:** `slideWidth` is computed from the wrong width, so slides don’t match the visible area → looks like right edge cutoff or misalignment.

---

### 2. `pagingEnabled` + `paddingHorizontal` conflict

- With `pagingEnabled`, RN uses the viewport width as page size.
- With `contentContainerStyle={{ paddingHorizontal: X }}`, content has side padding.
- Snap points become: `0`, `viewportWidth`, `2*viewportWidth`, …
- Content layout is: `[padL][slide0][slide1]…[padR]`.

At offset 0:
- Visible: `padL + slide0` + a bit more (depending on viewport vs `slideWidth`).
- If viewport > padL + slide0, the next slide peeks in → feels like right side is cut off.
- If viewport < padL + slide0, part of the current slide is cut off on the right.

Either way, mixing `pagingEnabled` with padding can cause cutoff or peeking.

---

### 3. `snapToInterval` vs page width mismatch

- `snapToInterval={slideWidth}` and `pagingEnabled` both affect snapping.
- `pagingEnabled` snaps by viewport width.
- `snapToInterval` snaps by `slideWidth`.
- If `slideWidth !== viewportWidth`, they fight → wrong snap positions and cutoff.

---

### 4. Pixel rounding (Retina / fractional pixels)

- On Retina, widths can be fractional.
- `slideWidth = screenWidth - 24` may not align perfectly with device pixels.
- Small rounding errors can cause 1–2px gaps or overlap and make the edge look cut off.

---

### 5. Desired behavior vs current design

- Current: `slideWidth = screenWidth - 2*contentPaddingH` → margins on both sides.
- Desired: true full-width, edge-to-edge.
- If “cutoff” means “I want no side margins,” the current margins are by design, not a bug.

---

## Recommended fixes (in priority order)

### Fix 1: Use `onLayout` for real width (high priority)

Measure the carousel container with `onLayout` and use that width instead of `useWindowDimensions`:

```tsx
const [containerWidth, setContainerWidth] = useState(0);

const onContainerLayout = (e: LayoutChangeEvent) => {
  const { width } = e.nativeEvent.layout;
  if (width > 0) setContainerWidth(width);
};

// Use containerWidth instead of screenWidth for slideWidth
// slideWidth = containerWidth - (contentPaddingH * 2)  // if keeping margins
// OR slideWidth = containerWidth                      // for true full-width
```

This aligns `slideWidth` with the actual FlatList viewport.

---

### Fix 2: True full-width (edge-to-edge)

1. Set `slideWidth = containerWidth` (or `screenWidth` if you keep using that).
2. Remove `contentContainerStyle` horizontal padding from the FlatList.
3. Add `contentContainerStyle={{ paddingHorizontal: 0 }}` (or omit padding).
4. Optionally add a small outer margin for the section (e.g. on the parent) instead of inside the carousel.

---

### Fix 3: Snapping without `pagingEnabled`

If you keep padding:

1. Remove `pagingEnabled`.
2. Use only `snapToInterval={slideWidth}` and `snapToAlignment="start"`.
3. Optionally use `decelerationRate="fast"`.

This avoids the `pagingEnabled` vs padding conflict and should eliminate cutoff/peek.

---

### Fix 4: Pixel-perfect snapping (optional)

Use `PixelRatio.roundToNearestPixel()` when computing `slideWidth`:

```ts
import { PixelRatio } from 'react-native';
slideWidth = PixelRatio.roundToNearestPixel(containerWidth - (contentPaddingH * 2));
```

---

## Summary

| Issue                        | Cause                                | Fix                                      |
|-----------------------------|--------------------------------------|------------------------------------------|
| Wrong width                 | `useWindowDimensions` vs real layout | Use `onLayout` on carousel container      |
| Snap / cutoff               | `pagingEnabled` + padding            | Remove `pagingEnabled` or adjust padding  |
| Snap mismatch               | `slideWidth` ≠ viewport              | Make `slideWidth` = measured viewport     |
| Margins vs full-width       | Design choice                        | `slideWidth = containerWidth`, no padding |
| Sub-pixel rounding          | Retina fractional pixels             | `PixelRatio.roundToNearestPixel()`        |

Implementing Fix 1 (onLayout) and Fix 3 (no `pagingEnabled`) should remove the iOS right-edge cutoff. Use Fix 2 if you want true edge-to-edge slides.
