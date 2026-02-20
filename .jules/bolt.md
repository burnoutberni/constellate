## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-12-20 - CalendarView Event Grouping Complexity

**Learning:** `CalendarView` (Month, Week, Day) was using O(N * M) nested loops to group events into days/hours, where N is events and M is slots. This scales poorly.
**Action:** Always prefer single-pass O(N) iteration over events to bucket them into Maps/Sets for rendering, reducing complexity significantly.
