## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-12-21 - CalendarView Data Processing

**Learning:** `CalendarView` was performing O(Slots * N) operations to filter events for each day/hour slot, which scales poorly.
**Action:** Replace nested filter loops in `useMemo` with a single O(N) pass that buckets items into a Map, then lookup O(1) in the render loop.
