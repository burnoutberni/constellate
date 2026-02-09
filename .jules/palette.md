## 2024-05-22 - Interactive Input Icons
**Learning:** The `Input` component's `rightIcon` was non-interactive by default (`pointer-events-none`), preventing accessible controls like "Clear" buttons inside inputs.
**Action:** Added `rightIconInteractive` prop to `Input` to allow clickable icons while maintaining default behavior. This enables accessible search clearing patterns.
