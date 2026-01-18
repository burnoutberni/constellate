## 2025-02-17 - Interactive Input Icons
**Learning:** Input fields with action icons (like clear/search) need specific click handlers and ARIA labels, separate from the icon rendering itself.
**Action:** Extend Input component props to include `onRightIconClick` and `rightIconAriaLabel` instead of wrapping the icon in a button externally.
