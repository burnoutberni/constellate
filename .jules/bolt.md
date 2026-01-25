## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-01-08 - N+1 Queries in SocialGraphService

**Learning:** `SocialGraphService.resolveFollowedUserIds` was iterating over a list of followed users and performing a database query for each one (`resolveActorUser`), causing O(N) queries during feed generation. This is a critical bottleneck as user following lists grow.
**Action:** Replace iterative DB queries with batched `findMany` calls using `IN` clauses. When refactoring for batching, care must be taken to preserve the order of results if the original logic implied an ordered return, or use Maps for O(1) lookups to reconstruct the order.
