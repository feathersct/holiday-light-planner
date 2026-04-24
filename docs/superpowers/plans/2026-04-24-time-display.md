# Time Display for Listings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show event times alongside dates in listing cards and the detail modal, using the times already stored in `startDatetime` / `endDatetime`.

**Architecture:** Add a `formatTimeRange` utility function to `listing.model.ts` that returns a formatted time string or `null` for midnight. `DisplayCardComponent` uses it to conditionally render a time line. `DisplayDetailComponent` always renders a time line, showing "All day" as a fallback. No backend changes.

**Tech Stack:** Angular 17 standalone components, inline templates, TypeScript.

---

## File Map

| File | Change |
|---|---|
| `frontend/src/app/models/listing.model.ts` | Add `formatTimeRange` export |
| `frontend/src/app/shared/display-card/display-card.component.ts` | Import `formatTimeRange`, add `timeRange` getter, render time conditionally |
| `frontend/src/app/shared/display-detail/display-detail.component.ts` | Import and expose `formatTimeRange`, render time with "All day" fallback |

---

### Task 1: Add `formatTimeRange` to listing.model.ts

**Files:**
- Modify: `frontend/src/app/models/listing.model.ts`

- [ ] **Step 1: Add `formatTimeRange` after the existing `formatDateRange` function**

Open `frontend/src/app/models/listing.model.ts`. The existing `formatDateRange` function is at the bottom of the file (around line 216). Add the new function immediately after it:

```typescript
export function formatTimeRange(start: string, end: string): string | null {
  const s = new Date(start), e = new Date(end);
  const midnight = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0;
  if (midnight(s) && midnight(e)) return null;
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmt(s)} – ${fmt(e)}`;
}
```

- [ ] **Step 2: Verify the build compiles**

Run from `frontend/`:
```bash
npm run build 2>&1 | tail -6
```
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/models/listing.model.ts
git commit -m "feat: add formatTimeRange utility function"
```

---

### Task 2: Show time in DisplayCardComponent

**Files:**
- Modify: `frontend/src/app/shared/display-card/display-card.component.ts`

Current state: the card shows `📅 {{dateRange}}` on one line. The `dateRange` getter calls `formatDateRange`. There is no time display.

- [ ] **Step 1: Import `formatTimeRange` and add a `timeRange` getter**

In `display-card.component.ts` line 3, the import currently is:
```typescript
import { ListingSummary, CATEGORY_COLORS, CATEGORY_LABELS, formatDateRange } from '../../models/listing.model';
```

Replace with:
```typescript
import { ListingSummary, CATEGORY_COLORS, CATEGORY_LABELS, formatDateRange, formatTimeRange } from '../../models/listing.model';
```

In the class body (after the existing `get dateRange()` getter), add:
```typescript
get timeRange() { return formatTimeRange(this.display.startDatetime, this.display.endDatetime); }
```

- [ ] **Step 2: Add the conditional time line to the template**

Find this line in the template (around line 45):
```html
        <div style="font-size:11.5px;color:#9ca3af;margin-bottom:8px">📅 {{dateRange}}</div>
```

Replace it with:
```html
        <div [style.margin-bottom]="timeRange ? '2px' : '8px'"
             style="font-size:11.5px;color:#9ca3af">📅 {{dateRange}}</div>
        <div *ngIf="timeRange"
             style="font-size:11.5px;color:#9ca3af;margin-bottom:8px">🕐 {{timeRange}}</div>
```

- [ ] **Step 3: Verify the build compiles**

```bash
npm run build 2>&1 | tail -6
```
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/shared/display-card/display-card.component.ts
git commit -m "feat: show time on listing cards when non-midnight"
```

---

### Task 3: Show time in DisplayDetailComponent

**Files:**
- Modify: `frontend/src/app/shared/display-detail/display-detail.component.ts`

Current state: the detail modal shows a category badge and date range in a flex row. There is no time display.

- [ ] **Step 1: Import `formatTimeRange` and expose it on the class**

In `display-detail.component.ts` line 3, the import currently is:
```typescript
import { Listing, ListingSummary, HostUser, CATEGORY_COLORS, CATEGORY_LABELS, formatDateRange } from '../../models/listing.model';
```

Replace with:
```typescript
import { Listing, ListingSummary, HostUser, CATEGORY_COLORS, CATEGORY_LABELS, formatDateRange, formatTimeRange } from '../../models/listing.model';
```

In the class body, after the existing `formatDateRange = formatDateRange;` line, add:
```typescript
formatTimeRange = formatTimeRange;
```

- [ ] **Step 2: Add the time line to the template**

Find this block in the template (around lines 78–87) — the category badge + date range section:
```html
            <!-- Category badge + date range -->
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              <span [style.background]="categoryColors[fullDisplay()!.category]?.bg"
                    [style.color]="categoryColors[fullDisplay()!.category]?.text"
                    style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px">
                {{categoryLabels[fullDisplay()!.category]}}
              </span>
              <span style="font-size:12px;color:#64748b">
                {{formatDateRange(fullDisplay()!.startDatetime, fullDisplay()!.endDatetime)}}
              </span>
            </div>
```

Replace it with:
```html
            <!-- Category badge + date range -->
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span [style.background]="categoryColors[fullDisplay()!.category]?.bg"
                    [style.color]="categoryColors[fullDisplay()!.category]?.text"
                    style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px">
                {{categoryLabels[fullDisplay()!.category]}}
              </span>
              <span style="font-size:12px;color:#64748b">
                {{formatDateRange(fullDisplay()!.startDatetime, fullDisplay()!.endDatetime)}}
              </span>
            </div>
            <!-- Time range -->
            <div style="font-size:12px;color:#64748b;margin-top:-8px">
              🕐 {{formatTimeRange(fullDisplay()!.startDatetime, fullDisplay()!.endDatetime) ?? 'All day'}}
            </div>
```

- [ ] **Step 3: Verify the build compiles**

```bash
npm run build 2>&1 | tail -6
```
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/shared/display-detail/display-detail.component.ts
git commit -m "feat: show time in listing detail modal with All day fallback"
```
