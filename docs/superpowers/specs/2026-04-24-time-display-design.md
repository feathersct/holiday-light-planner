# Time Display for Listings — Design Spec

**Date:** 2026-04-24

## Overview

Show event times alongside dates in listing cards and the detail modal. The data is already stored — `startDatetime` and `endDatetime` are full datetimes collected via `datetime-local` inputs in the submit form. This is a pure display-layer change.

---

## Behavior

### Time detection

A listing is considered "all day" if both `startDatetime` and `endDatetime` have a time component of exactly midnight (00:00). This is the default when a user does not set a specific time.

### Display cards (`DisplayCardComponent`)

- Show the time range below the date range **only when non-midnight**.
- If both times are midnight, show nothing (no "All day" label on cards — keeps cards compact).
- Example when time is set: date line "Dec 12 – Jan 15", time line "5:00 PM – 9:00 PM"

### Detail modal (`DisplayDetailComponent`)

- Always show a time line below the date range.
- If non-midnight: show the formatted time range (e.g., "7:00 PM – 10:00 PM").
- If midnight: show "All day".
- Two separate lines — date is never combined with time on a single line.

---

## New Utility Function

Add `formatTimeRange` to `frontend/src/app/models/listing.model.ts`:

```typescript
export function formatTimeRange(start: string, end: string): string | null {
  const s = new Date(start), e = new Date(end);
  const midnight = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0;
  if (midnight(s) && midnight(e)) return null;
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmt(s)} – ${fmt(e)}`;
}
```

Returns `null` when both times are midnight; otherwise returns a formatted string like `"5:00 PM – 9:00 PM"`.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/app/models/listing.model.ts` | Add `formatTimeRange` export |
| `frontend/src/app/shared/display-card/display-card.component.ts` | Import and use `formatTimeRange`; show time line when non-null |
| `frontend/src/app/shared/display-detail/display-detail.component.ts` | Import and use `formatTimeRange`; always show time line, "All day" fallback |

---

## Out of Scope

- Changing the submit form (times already collected via `datetime-local`).
- Backend changes.
- Timezone handling (display uses the browser's local timezone, consistent with how dates are already shown).
- Showing time in the map marker or bottom sheet header.
