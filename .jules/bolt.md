## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-12-20 - N+1 in Social Graph Resolution

**Learning:** `SocialGraphService.resolveFollowedUserIds` was performing N+1 queries (one per followed user) to resolve actor URLs to user IDs, significantly slowing down feed generation for users with many followings.
**Action:** Use batch queries (`findMany` with `in` operator) when resolving lists of identifiers or URLs, splitting by local/remote if necessary.
