## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2026-02-03 - FeedPage Memoization

**Learning:** `FeedPage` was performing expensive Zod validation (`safeParse`) for every item on every render, which could cause jank on large feeds.
**Action:** Move data transformation and validation into `useMemo` when rendering lists derived from query data, so it only runs when the data actually changes.
