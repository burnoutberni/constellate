## 2024-05-23 - Delete Confirmation Consistency
**Learning:** Found that `ReminderItem` triggered immediate deletion without confirmation, risking accidental data loss. A `ConfirmationModal` component exists but isn't consistently applied to destructive actions.
**Action:** Audit other delete actions (e.g., NotificationItem, CommentItem) to ensure they use `ConfirmationModal` or similar patterns.
