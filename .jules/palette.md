## 2026-01-26 - Interactive Input Icons
**Learning:** `Input` components often block pointer events on icons (`pointer-events-none`) for layout stability, but this prevents useful patterns like "Clear" or "Show Password" buttons.
**Action:** Extend `Input` components to support an `onRightIconClick` prop that conditionally renders the icon wrapper as an accessible `<button>` instead of a `<div>`, ensuring keyboard accessibility and proper focus management.
