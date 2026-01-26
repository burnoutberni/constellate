## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-02-14 - FeedPage Zod Validation Re-renders

**Learning:** Zod schema validation (`safeParse`) creates new object references on every execution; therefore, performing validation inside a React render loop will invalidate `React.memo` on child components unless the validation result or the rendered output is memoized.
**Action:** Memoize the result of data mapping/validation using `useMemo` so that stable object references are passed to children.
