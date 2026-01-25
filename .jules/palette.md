## 2024-03-24 - Modal Focus Trapping
**Learning:** Modals in this application previously relied on a nonexistent "manual focus trap", leaving keyboard users able to tab out into background content. This breaks accessibility guidelines (WCAG 2.1.2) and disorients screen reader users.
**Action:** Implemented a lightweight, dependency-free focus trap within the `Modal` component. It uses a `useEffect` to listen for `keydown` (Tab/Shift+Tab) and circles focus between the first and last focusable elements. This is now the standard for all modals in the system.
