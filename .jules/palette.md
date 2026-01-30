# Palette's Journal

## 2024-05-22 - Interactive Input Icons
**Learning:** The `Input` component pattern with `rightIcon` was non-interactive (`pointer-events-none`). Extending it with `onRightIconClick` enables accessible interaction patterns (like clear buttons) while maintaining visual consistency.
**Action:** When needing interactive icons in inputs, use the `onRightIconClick` prop instead of wrapping the Input or creating custom overlays, to ensure proper keyboard accessibility and focus management.
