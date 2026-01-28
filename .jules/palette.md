## 2025-02-19 - Interactive Input Icons
**Learning:** The `Input` component originally used `pointer-events-none` for all icons, preventing interactivity.
**Action:** Use `onRightIconClick` and `rightIconAriaLabel` props on `Input` to enable interactive icons (like clear buttons or password toggles) that are accessible and keyboard navigable.
