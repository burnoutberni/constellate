## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-01-28 - FeedPage Validation Bottleneck

**Learning:** Zod validation (`.safeParse`) inside a render loop (e.g., `allItems.map`) is extremely expensive and runs on every re-render. Memoizing the validated list significantly reduces CPU usage during interactions.
**Action:** Always process and validate raw API data inside `useMemo` or `useQuery` select function, never during render.
