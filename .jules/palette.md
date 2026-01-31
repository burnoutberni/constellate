## 2024-05-23 - Inconsistent Form Labeling Patterns
**Learning:** Some modals (like `AppealModal`) were manually rendering `<label>` elements separate from inputs, while `Input`/`Select`/`Textarea` components support a `label` prop that handles ID generation and `htmlFor` association automatically. The manual approach often leads to missing `htmlFor` attributes, breaking accessibility.
**Action:** Always check if UI components support a `label` prop before manually creating one. Refactor manual labels to use the component prop for guaranteed accessibility linkage.
