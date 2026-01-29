## 2024-05-24 - Interactive Icons in Input Fields
**Learning:** `Input` component previously enforced `pointer-events-none` on right icons, preventing interactivity.
**Action:** Use the new `onRightIconClick` prop in `Input` to enable interactive icons (like clear buttons) while maintaining accessibility via `rightIconAriaLabel`.
