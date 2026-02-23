## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-05-18 - FeedPage Validation Optimization

**Learning:** `FeedPage` was running expensive Zod schema validation (`safeParse`) for every item in the feed on every render loop. This caused performance degradation during unrelated state updates (like modal toggles) or scrolling.
**Action:** Move data validation and transformation logic into `useMemo` hooks. This ensures validation only runs when the underlying data changes, not on every re-render.
