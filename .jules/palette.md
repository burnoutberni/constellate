## 2024-05-22 - Interactive Input Icons
**Learning:** The `Input` component previously blocked pointer events on the right icon container, preventing the use of interactive elements like clear buttons.
**Action:** When adding interactive elements to inputs (like clear buttons or password toggles), use the new `rightIconInteractive` prop to enable pointer events.
