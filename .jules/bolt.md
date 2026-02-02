## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-12-21 - FeedPage Validation Bottleneck

**Learning:** `FeedPage` was running expensive Zod schema validation (`getValidatedData`) inside the render loop for every item. This, combined with `EventCard` not being memoized, caused expensive re-renders and re-validations of the entire feed on any state change.
**Action:** Use `useMemo` to transform and validate raw query data into a stable "view model" list. Combine this with `React.memo` on list item components (`EventCard`) to ensure they only re-render when their specific data changes.
