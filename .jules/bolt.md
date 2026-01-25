## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-01-21 - SocialGraph N+1 and Prismock Limits

**Learning:** `SocialGraphService.resolveFollowedUserIds` was executing N+1 queries by looping `following`. Also, `prismock` strictly validates `findUnique` `where` clauses, failing if non-unique fields (like `isRemote`) are included, whereas `findMany` is more flexible.
**Action:** Always batch database lookups using `findMany` with `in` operator instead of looping. When refactoring legacy code, be aware that `findUnique` logic might be fragile if it includes filter fields.
