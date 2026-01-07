## 2026-01-07 - Autocomplete Accessibility
**Learning:** Implementing accessible autocomplete requires careful coordination of `aria-activedescendant` and stable IDs. Since `useId` generates unique IDs per render, it's not always sufficient for dynamic lists where items need stable IDs that can be referenced by index. Using a combination of `type` and `id` (e.g., `search-result-user-${id}`) provided a stable solution for the search dropdown.

**Action:** When building custom listboxes or autocompletes, ensure item IDs are deterministic and derived from data, not just index, to support `aria-activedescendant` correctly.
