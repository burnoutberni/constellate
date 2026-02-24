## 2025-12-20 - CalendarView Re-renders

**Learning:** `CalendarView` re-renders all event buttons when `userAttendingEventIds` changes because the event click handler was recreated on every render, invalidating `React.memo` if it were used.
**Action:** When optimizing list rendering, ensure callback props are stable (using `useCallback` or `useMemo`) so `React.memo` on list items is effective.

## 2025-12-20 - EventDetailPage Render Loop

**Learning:** `EventDetailPage` has a `currentTime` state that updates every second via `setInterval` to check if the event has started. This caused the entire component tree (including expensive lists like comments and attendees) to re-render every second because callback props passed to children were recreated on every render.
**Action:** Stabilized all callback props using `useCallback`, ensuring `mutateAsync` is destructured from TanStack Query hooks (as it is stable, unlike the mutation object). Memoized all heavy child components (`EventInfo`, `AttendanceWidget`, `CommentList`, etc.) with `React.memo` to stop the re-render cascade.
