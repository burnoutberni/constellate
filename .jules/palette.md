## 2025-02-21 - Accessible Search Bar Pattern
**Learning:** When a Search Bar lacks a visible label (common in headers), `aria-label` combined with `role="combobox"` on the input is essential. For custom dropdowns, implementing `aria-activedescendant` maintains the native input focus while announcing list navigation.
**Action:** Use this pattern for all autocomplete-style inputs in the application to ensure screen reader accessibility without compromising visual design.
