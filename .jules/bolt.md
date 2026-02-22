## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-12-20 - CalendarView Complexity

**Learning:** `CalendarView` (Month, Week, Day) was using O(N*M) nested loops to filter events for each time slot (M slots). This scales poorly with many events.
**Action:** Replace nested loops with O(N) bucketing into Maps (Day -> Events, Hour -> Events) to optimize rendering speed, especially for busy calendars.
