## 2024-05-22 - Input Component Interaction Limitation
**Learning:** The `Input` component had `pointer-events-none` hardcoded on the `rightIcon` container, preventing any interactive elements (like clear buttons or toggle visibility) from working.
**Action:** When adding interactive icons to Inputs, check if the component supports interaction. I added `onRightIconClick` and `rightIconLabel` props to the `Input` component to handle this accessibly (rendering a `<button>`).
