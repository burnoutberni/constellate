## 2024-05-23 - Interactive Input Icons Constraint
**Learning:** The `Input` component wraps `rightIcon` in a `div` with `pointer-events-none` by default. This prevents any interactivity (like tooltips or click handlers) on icons passed to it, even if they are buttons.
**Action:** When adding interactive elements to inputs (like password toggles or clear buttons), we must use the newly added `onRightIconClick` prop or modify the component further to support custom interactive children.
