## 2024-05-24 - Input Component Interactivity
**Learning:** The `Input` component was originally designed with `pointer-events-none` for all icons, preventing interactive elements like "clear" buttons. This limited the flexibility of the component for common UX patterns.
**Action:** When adding icons to inputs, checking if they need to be interactive (like a clear button or password toggle) and handling accessibility (keyboard focus, aria-label) is crucial. The `Input` component now supports `onRightIconClick` and `onLeftIconClick` to handle these cases accessibly.
