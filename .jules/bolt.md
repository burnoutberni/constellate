## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-12-24 - ActivityFeedItem Optimization

**Learning:** List items like `ActivityFeedItem` in `FeedPage` can cause significant performance overhead if not memoized, especially when parent state (like date filters) changes frequently.
**Action:** Always wrap list item components in `React.memo` when they are rendered in a loop, provided their props are stable or primitives.
