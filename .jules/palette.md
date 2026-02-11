## 2025-02-18 - UI Component Label Props
**Learning:** The `Select`, `Textarea`, and `Input` components in `client/src/components/ui/` have a built-in `label` prop that handles ID generation and accessibility attributes (like `htmlFor`). Developers often manually render `<label>` elements separately, breaking the accessibility association.
**Action:** When using these components, always use the `label` prop instead of external `<label>` elements to ensure proper `htmlFor` association and accessible form controls.
