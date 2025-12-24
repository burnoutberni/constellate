## 2024-05-24 - Accessibility: Manual Focus Management
**Learning:** For custom modals, manual focus trapping (cycling Tab/Shift+Tab) and focus restoration (returning focus to trigger) are critical.
**Action:** When implementing overlays, always verify: 1. Initial focus is set inside. 2. Tab cycle is constrained. 3. Focus returns on close. 4. Use `ref` to store previous focus.
