## 2024-05-22 - Interactive Input Icons
**Learning:** The `Input` component's right icon container has `pointer-events-none` by default, blocking interactions.
**Action:** When adding interactive elements (like clear buttons) to `Input` right icon slot, use the `rightIconInteractive` prop (added in this PR) to enable pointer events.
