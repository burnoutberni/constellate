## 2024-05-23 - Interactive Input Icons
**Learning:** The `Input` component enforces `pointer-events-none` on icons, preventing standard patterns like "Clear Input" or "Show Password". This forces developers to rebuild input wrappers for basic functionality.
**Action:** Update base `Input` component to support optional click handlers for icons, enabling accessible interactive patterns while maintaining default static behavior.
