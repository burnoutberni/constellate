## 2026-01-23 - Focus Management in Modals
**Learning:** The custom `Modal` component lacked a focus trap, allowing keyboard users to tab out of the modal into the background content.
**Action:** Implemented a custom focus trap using `useEffect` and `keydown` listener that dynamically queries focusable elements, ensuring robustness even if modal content changes. Validated with `userEvent` tests.
