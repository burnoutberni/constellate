## 2026-02-03 - Interactive Icons in Inputs
**Learning:** Standard input components often wrap icons in `pointer-events-none` containers for layout stability. To support interactive icons (like clear buttons), we must explicitly manage pointer events and accessibility attributes (role, tabIndex, aria-label) on the wrapper.
**Action:** When adding interactive elements to existing inputs, ensure the wrapper allows pointer events and provides proper accessible names, handling disabled states gracefully.
