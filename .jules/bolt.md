## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-01-02 - FeedPage Optimization Hook Violation

**Learning:** Moving expensive logic into `useMemo` in `FeedPage` triggered "Rendered more hooks than during the previous render" because `useMemo` was placed after a conditional early return.
**Action:** When adding hooks for optimization, always ensure they are placed at the top level of the component, before any conditional return statements, even if they depend on data that might trigger an early return (ensure safe fallback for dependencies).

## 2025-01-02 - Infinite Query Mocking

**Learning:** Mocking `useInfiniteQuery` endpoints in Playwright requires returning a single page structure (e.g., `{ items: [...] }`), not the aggregated `{ pages: [...] }` structure, as React Query handles the aggregation.
**Action:** Verify mock data structure matches exactly what the single API call returns, not what the React Query hook returns.
