## 2024-05-23 - Interactive Input Icons
**Learning:** The `Input` component used `pointer-events-none` on right icons by default, preventing interactions like clear buttons. Added `rightIconInteractive` prop to optionally allow clicks.
**Action:** Use `rightIconInteractive={true}` when adding clickable elements (buttons, toggles) inside inputs.
