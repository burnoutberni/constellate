## 2025-01-30 - Accessible Form Components
**Learning:** The `Select` and `Textarea` components in this design system have a `label` prop that automatically handles `htmlFor` association. Using manual `<label>` elements alongside these components often leads to unassociated labels, breaking accessibility for screen readers.
**Action:** Always prefer the `label` prop over manual label elements when using `Select`, `Textarea`, or `Input` components to ensure proper accessibility linkage.
