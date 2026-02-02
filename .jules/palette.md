## 2025-02-18 - Input Component Right Icon Interactivity
**Learning:** The `Input` component's `rightIcon` wrapper had `pointer-events-none`, preventing interactive elements like clear buttons.
**Action:** When adding interactive icons to inputs (like clear or toggle password), use the new `onRightIconClick` prop which renders a semantic `<button>` and handles accessibility and pointer events automatically.
