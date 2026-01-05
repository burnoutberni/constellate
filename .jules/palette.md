## 2026-01-05 - SearchBar Accessibility & UX
**Learning:** The `Input` component's `rightIcon` prop is wrapped in `pointer-events-none`, which prevents interactive elements (like a clear button) from being used there. Interactive elements must be positioned manually.
**Action:** When adding interactive icons to inputs, avoid `rightIcon` prop. Instead, wrap the `Input` in a relative container and position the button absolutely. Manually manage padding if needed (e.g., `pr-10`).
**Learning:** For testing async components with debounce in this specific Vitest setup, `vi.useFakeTimers()` caused timeouts with `waitFor`.
**Action:** Use `vi.useRealTimers()` and `waitFor` for more reliable async testing here.
