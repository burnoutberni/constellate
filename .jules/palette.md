## 2024-05-22 - Interactive Input Icons
**Learning:** The `Input` component used `pointer-events-none` on the `rightIcon` container, preventing interactive elements like "Clear" buttons or "Show Password" toggles.
**Action:** Added `onRightIconClick` prop to `Input` to enable interactivity. Future components needing interactive icons inside inputs should use this prop or the pattern established in `SearchBar` (Spinner on left, Action on right).
