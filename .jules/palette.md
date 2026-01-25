## 2025-02-14 - Input Component Interactivity
**Learning:** The base `Input` component disables pointer events on the right icon container by default, making it impossible to add interactive elements like clear buttons without modification.
**Action:** When adding interactive elements to Inputs (like clear buttons or toggle password visibility), ensure the `Input` component supports `onRightIconClick` or similar props to enable pointer events and semantic button wrapping.
