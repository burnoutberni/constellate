## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-12-20 - CalendarView Bucket Logic

**Learning:** `CalendarView` (Day/Week/Month) components were using nested loops (O(Slots × N)) to filter events for each time slot, causing performance issues with large event lists.
**Action:** Invert the logic to iterate over events once (O(N)) and bucket them into a Map keyed by slot ID (day/hour). This significantly reduces complexity.
