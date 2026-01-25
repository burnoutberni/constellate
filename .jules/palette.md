## 2025-05-30 - Custom Modal Missing Focus Trap
**Learning:** Custom `Modal` components often implement visual overlay and `Escape` key handling but miss focus management (trapping and restoration), leading to severe accessibility issues for keyboard users.
**Action:** Always verify custom Modals for `focus-trap` implementation or `inert` usage. Use a `useEffect` to manage focus if dependencies are restricted.
