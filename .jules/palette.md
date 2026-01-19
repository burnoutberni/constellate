## 2025-01-27 - Input Interaction Pattern
**Learning:** The `Input` component lacked support for interactive right icons, relying on a non-interactive wrapper. This forced components like `SearchBar` to either hack accessibility or lack features.
**Action:** Enhance low-level UI components (like `Input`) to support interactivity (onClick, Aria labels) natively rather than hacking wrappers in parent components. This ensures consistent keyboard accessibility.
