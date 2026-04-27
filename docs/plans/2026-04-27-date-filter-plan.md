# Date Filter for Map Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Date" button to the map filter bar that lets users show only listings active Today, Tomorrow, or This Week — defaulting to Today on load.

**Architecture:** Purely client-side filtering added to the existing `get filtered()` getter in `MapComponent`. A new `matchesDateFilter` helper function in `listing.model.ts` handles all date window logic. No backend changes.

**Tech Stack:** Angular 17 standalone components, inline templates, Jasmine/Karma tests

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/app/models/listing.model.ts` | Add `DateFilter` type, update `FilterState`, add `matchesDateFilter` helper |
| `frontend/src/app/models/listing.model.spec.ts` | Create — unit tests for `matchesDateFilter` |
| `frontend/src/app/pages/map/map.component.ts` | Add state, update logic, update both templates |

---

## Task 1: Add `DateFilter` type, stub `matchesDateFilter`, and update `FilterState`

**Files:**
- Modify: `frontend/src/app/models/listing.model.ts`

- [ ] **Step 1: Add `DateFilter` type after the `DisplayType` line (line 35)**

In `listing.model.ts`, after this line:
```ts
export type DisplayType = 'DRIVE_BY' | 'WALK_THROUGH' | 'BOTH';
```

Add:
```ts
export type DateFilter = 'today' | 'tomorrow' | 'this-week' | 'all';
```

- [ ] **Step 2: Add `dateFilter` to `FilterState` (line 152)**

Replace:
```ts
export interface FilterState {
  category: Category | '';
  tags: string[];
  lat: number;
  lng: number;
  radius: number;
}
```

With:
```ts
export interface FilterState {
  category: Category | '';
  tags: string[];
  lat: number;
  lng: number;
  radius: number;
  dateFilter?: DateFilter;
}
```

- [ ] **Step 3: Add a stub `matchesDateFilter` after the `isUpcoming` function (after line 237)**

After:
```ts
export function isUpcoming(listing: ListingSummary): boolean {
  return new Date(listing.startDatetime) > new Date();
}
```

Add:
```ts
export function matchesDateFilter(listing: ListingSummary, filter: DateFilter, now = new Date()): boolean {
  return true; // implemented in Task 3
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/models/listing.model.ts
git commit -m "feat: add DateFilter type and FilterState field"
```

---

## Task 2: Write failing tests for `matchesDateFilter`

**Files:**
- Create: `frontend/src/app/models/listing.model.spec.ts`

- [ ] **Step 1: Create the spec file**

```ts
import { matchesDateFilter, DateFilter, ListingSummary } from './listing.model';

function makeListing(start: string, end: string): ListingSummary {
  return { startDatetime: start, endDatetime: end } as ListingSummary;
}

// Fixed reference point: 2026-01-15 at 5:00 PM
const NOW = new Date('2026-01-15T17:00:00');

describe('matchesDateFilter', () => {
  describe('all', () => {
    it('always returns true regardless of dates', () => {
      expect(matchesDateFilter(makeListing('2020-01-01', '2020-01-02'), 'all', NOW)).toBeTrue();
    });
  });

  describe('today', () => {
    it('includes a listing currently in progress (started yesterday, ends tomorrow)', () => {
      expect(matchesDateFilter(makeListing('2026-01-14', '2026-01-16'), 'today', NOW)).toBeTrue();
    });

    it('includes a listing that starts later today (6 PM)', () => {
      expect(matchesDateFilter(makeListing('2026-01-15T18:00:00', '2026-01-15T22:00:00'), 'today', NOW)).toBeTrue();
    });

    it('excludes a listing that ended earlier today (4 PM, it is now 5 PM)', () => {
      expect(matchesDateFilter(makeListing('2026-01-15T08:00:00', '2026-01-15T16:00:00'), 'today', NOW)).toBeFalse();
    });

    it('excludes a listing that starts tomorrow', () => {
      expect(matchesDateFilter(makeListing('2026-01-16', '2026-01-17'), 'today', NOW)).toBeFalse();
    });
  });

  describe('tomorrow', () => {
    it('includes a listing spanning today through tomorrow', () => {
      expect(matchesDateFilter(makeListing('2026-01-15', '2026-01-16T20:00:00'), 'tomorrow', NOW)).toBeTrue();
    });

    it('includes a listing that starts tomorrow', () => {
      expect(matchesDateFilter(makeListing('2026-01-16T08:00:00', '2026-01-20'), 'tomorrow', NOW)).toBeTrue();
    });

    it('excludes a listing that ends today before midnight', () => {
      expect(matchesDateFilter(makeListing('2026-01-15T08:00:00', '2026-01-15T23:00:00'), 'tomorrow', NOW)).toBeFalse();
    });

    it('excludes a listing that starts the day after tomorrow', () => {
      expect(matchesDateFilter(makeListing('2026-01-17', '2026-01-18'), 'tomorrow', NOW)).toBeFalse();
    });
  });

  describe('this-week', () => {
    it('includes a listing starting in 3 days', () => {
      expect(matchesDateFilter(makeListing('2026-01-18', '2026-01-20'), 'this-week', NOW)).toBeTrue();
    });

    it('includes a listing currently in progress that ends next week', () => {
      expect(matchesDateFilter(makeListing('2026-01-10', '2026-01-20'), 'this-week', NOW)).toBeTrue();
    });

    it('excludes a listing that ended before now', () => {
      expect(matchesDateFilter(makeListing('2026-01-14', '2026-01-15T16:00:00'), 'this-week', NOW)).toBeFalse();
    });

    it('excludes a listing starting more than 7 days from now', () => {
      expect(matchesDateFilter(makeListing('2026-01-23', '2026-01-25'), 'this-week', NOW)).toBeFalse();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npx ng test --watch=false
```

Expected: several FAILED specs — `matchesDateFilter` stub returns `true` for everything, so the `toBeFalse()` assertions will fail.

---

## Task 3: Implement `matchesDateFilter`

**Files:**
- Modify: `frontend/src/app/models/listing.model.ts`

- [ ] **Step 1: Replace the stub with the full implementation**

Replace:
```ts
export function matchesDateFilter(listing: ListingSummary, filter: DateFilter, now = new Date()): boolean {
  return true; // implemented in Task 3
}
```

With:
```ts
export function matchesDateFilter(listing: ListingSummary, filter: DateFilter, now = new Date()): boolean {
  if (filter === 'all') return true;
  const start = new Date(listing.startDatetime);
  const end = new Date(listing.endDatetime);

  if (filter === 'today') {
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    return end > now && start <= endOfToday;
  }

  if (filter === 'tomorrow') {
    const startOfTomorrow = new Date(now);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    startOfTomorrow.setHours(0, 0, 0, 0);
    const endOfTomorrow = new Date(startOfTomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);
    return end >= startOfTomorrow && start <= endOfTomorrow;
  }

  // this-week
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return end > now && start <= endOfWeek;
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
cd frontend && npx ng test --watch=false
```

Expected: all `matchesDateFilter` specs PASS. Existing component tests also PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/models/listing.model.ts frontend/src/app/models/listing.model.spec.ts
git commit -m "feat: implement matchesDateFilter helper with tests"
```

---

## Task 4: Integrate date filter state and logic into `MapComponent`

**Files:**
- Modify: `frontend/src/app/pages/map/map.component.ts`

- [ ] **Step 1: Update the import line (line 12) to include `DateFilter` and `matchesDateFilter`**

Replace:
```ts
import { ListingSummary, CATEGORY_COLORS, CATEGORY_LABELS, Category, formatDateRange, isUpcoming, Tag, InitialFilters, FilterState } from '../../models/listing.model';
```

With:
```ts
import { ListingSummary, CATEGORY_COLORS, CATEGORY_LABELS, Category, formatDateRange, isUpcoming, Tag, InitialFilters, FilterState, DateFilter, matchesDateFilter } from '../../models/listing.model';
```

- [ ] **Step 2: Add `selectedDateFilter`, `dateOpen`, `dateOptions`, and `dateLabel` after the `loading` property (around line 442)**

After:
```ts
loading = false;
```

Add:
```ts
selectedDateFilter: DateFilter = 'today';
dateOpen = false;
dateOptions: Array<{ id: DateFilter; label: string }> = [
  { id: 'all',       label: 'All' },
  { id: 'today',     label: 'Today' },
  { id: 'tomorrow',  label: 'Tomorrow' },
  { id: 'this-week', label: 'This Week' },
];
get dateLabel(): string {
  const map: Record<DateFilter, string> = {
    all: 'Date', today: 'Date · Today', tomorrow: 'Date · Tomorrow', 'this-week': 'Date · This Week',
  };
  return map[this.selectedDateFilter];
}
```

- [ ] **Step 3: Add `setDateFilter` method after `toggleTag`**

After the `toggleTag` method, add:
```ts
setDateFilter(filter: DateFilter) {
  this.selectedDateFilter = filter;
  this.dateOpen = false;
}
```

- [ ] **Step 4: Update `get filtered()` to apply the date check**

Replace:
```ts
get filtered(): ListingSummary[] {
  return this.listings.filter(d => {
    if (this.activeTags.length && !this.activeTags.every(t => d.tags.some(tag => tag.name === t))) return false;
    return true;
  }).sort((a, b) => this.sortBy === 'popular' ? b.upvoteCount - a.upvoteCount : b.id - a.id);
}
```

With:
```ts
get filtered(): ListingSummary[] {
  return this.listings.filter(d => {
    if (this.activeTags.length && !this.activeTags.every(t => d.tags.some(tag => tag.name === t))) return false;
    if (!matchesDateFilter(d, this.selectedDateFilter)) return false;
    return true;
  }).sort((a, b) => this.sortBy === 'popular' ? b.upvoteCount - a.upvoteCount : b.id - a.id);
}
```

- [ ] **Step 5: Update `clearFilters()` to reset the date filter to `'today'`**

Replace:
```ts
clearFilters() {
  this.activeTags = [];
  this.selectedCategory = '';
  this.loadDisplays();
}
```

With:
```ts
clearFilters() {
  this.activeTags = [];
  this.selectedCategory = '';
  this.selectedDateFilter = 'today';
  this.loadDisplays();
}
```

- [ ] **Step 6: Update `emitFiltersChanged()` to include `dateFilter`**

Replace:
```ts
private emitFiltersChanged() {
  if (!this.map) return;
  const center = this.map.getCenter();
  this.filtersChanged.emit({
    category: this.selectedCategory,
    tags: [...this.activeTags],
    lat: center.lat,
    lng: center.lng,
    radius: this.radius,
  });
}
```

With:
```ts
private emitFiltersChanged() {
  if (!this.map) return;
  const center = this.map.getCenter();
  this.filtersChanged.emit({
    category: this.selectedCategory,
    tags: [...this.activeTags],
    lat: center.lat,
    lng: center.lng,
    radius: this.radius,
    dateFilter: this.selectedDateFilter,
  });
}
```

- [ ] **Step 7: Run existing tests to confirm nothing broke**

```bash
cd frontend && npx ng test --watch=false
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/pages/map/map.component.ts
git commit -m "feat: add date filter state and logic to MapComponent"
```

---

## Task 5: Add Date button and dropdown to the desktop filter bar

**Files:**
- Modify: `frontend/src/app/pages/map/map.component.ts` (template — `desktopFilters` ng-template, around line 363)

- [ ] **Step 1: Update the Tags button to also close the date dropdown when opened**

In the `desktopFilters` template, find the Tags button and replace its click handler:

Replace:
```html
          <button (click)="tagsOpen = !tagsOpen"
```

With:
```html
          <button (click)="tagsOpen = !tagsOpen; dateOpen = false"
```

- [ ] **Step 2: Add the Date button immediately before the Tags button**

In the `desktopFilters` template flex row, insert this block immediately before the Tags `<button>`:

```html
          <button (click)="dateOpen = !dateOpen; tagsOpen = false"
                  [style.border-color]="selectedDateFilter !== 'all' ? 'var(--accent)' : '#e2e8f0'"
                  [style.background]="selectedDateFilter !== 'all' ? 'var(--accent-bg)' : 'white'"
                  [style.color]="selectedDateFilter !== 'all' ? 'var(--accent-dark)' : '#475569'"
                  style="padding:5px 12px;border-radius:99px;font-size:12px;font-weight:600;
                         cursor:pointer;border:1.5px solid;display:flex;align-items:center;gap:5px">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {{dateLabel}}
          </button>
```

- [ ] **Step 3: Add the date dropdown panel inside the `desktopFilters` template**

After the closing `</div>` of the tags dropdown (`*ngIf="tagsOpen"`), add:

```html
        <div *ngIf="dateOpen" style="padding:8px 14px 12px;border-top:1px solid #f1f5f9;
                                      display:flex;flex-wrap:wrap;gap:6px">
          <button *ngFor="let opt of dateOptions" (click)="setDateFilter(opt.id)"
                  [style.background]="selectedDateFilter === opt.id ? 'var(--accent)' : '#f8fafc'"
                  [style.color]="selectedDateFilter === opt.id ? 'white' : '#475569'"
                  [style.border-color]="selectedDateFilter === opt.id ? 'var(--accent)' : '#e2e8f0'"
                  style="padding:4px 11px;border-radius:99px;font-size:11.5px;font-weight:600;
                         cursor:pointer;border:1.5px solid;transition:all 0.1s">
            {{opt.label}}
          </button>
        </div>
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx ng test --watch=false
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/pages/map/map.component.ts
git commit -m "feat: add Date filter button and dropdown to desktop filter bar"
```

---

## Task 6: Add Date button and dropdown to the mobile bottom sheet

**Files:**
- Modify: `frontend/src/app/pages/map/map.component.ts` (template — mobile section, around line 93)

- [ ] **Step 1: Add the Date button as the last item in the mobile chips scroll row**

In the mobile layout, the chips scroll row renders category buttons with `*ngFor`. After that `*ngFor` button block, still inside the scrolling `<div>`, add:

```html
              <button (click)="dateOpen = !dateOpen"
                      [style.border-color]="selectedDateFilter !== 'all' ? 'var(--accent)' : '#e2e8f0'"
                      [style.background]="selectedDateFilter !== 'all' ? 'var(--accent-bg)' : 'white'"
                      [style.color]="selectedDateFilter !== 'all' ? 'var(--accent-dark)' : '#374151'"
                      style="white-space:nowrap;padding:5px 12px;border-radius:99px;font-size:12px;
                             font-weight:600;cursor:pointer;border:1.5px solid;flex-shrink:0;
                             display:flex;align-items:center;gap:4px">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {{dateLabel}}
              </button>
```

- [ ] **Step 2: Add the date dropdown panel below the chips scroll row**

After the closing `</div>` of the chips scroll row, still inside the handle `<div>`, add:

```html
            <!-- Date dropdown (mobile) -->
            <div *ngIf="dateOpen" style="padding:6px 12px 10px;border-top:1px solid #f1f5f9;
                                          display:flex;gap:6px;flex-shrink:0">
              <button *ngFor="let opt of dateOptions" (click)="setDateFilter(opt.id)"
                      [style.background]="selectedDateFilter === opt.id ? 'var(--accent)' : '#f8fafc'"
                      [style.color]="selectedDateFilter === opt.id ? 'white' : '#475569'"
                      [style.border-color]="selectedDateFilter === opt.id ? 'var(--accent)' : '#e2e8f0'"
                      style="padding:4px 11px;border-radius:99px;font-size:11.5px;font-weight:600;
                             cursor:pointer;border:1.5px solid;white-space:nowrap">
                {{opt.label}}
              </button>
            </div>
```

- [ ] **Step 3: Run tests**

```bash
cd frontend && npx ng test --watch=false
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/pages/map/map.component.ts
git commit -m "feat: add Date filter button and dropdown to mobile bottom sheet"
```

---

## Task 7: Smoke test

- [ ] **Step 1: Start the app**

```bash
# Terminal 1 — backend + DB
docker compose up

# Terminal 2 — frontend
cd frontend && npm start
```

Open `http://localhost:4200`.

- [ ] **Step 2: Verify desktop behavior**

1. Filter bar shows "Date · Today" active (blue) on load
2. Clicking "Date · Today" opens dropdown with All / Today / Tomorrow / This Week — Today highlighted
3. Clicking "Tomorrow" closes dropdown, button updates to "Date · Tomorrow", listing count changes
4. Clicking "All" resets button to "Date", all non-expired listings visible
5. Clicking "Clear filters" → button returns to "Date · Today"
6. Tags dropdown and Date dropdown don't open simultaneously

- [ ] **Step 3: Verify mobile behavior**

1. Narrow browser to < 768 px (or use DevTools device mode)
2. Date button visible in horizontal scroll chips row, shows "Date · Today" on load
3. Tapping opens dropdown panel below the chips row
4. Selecting an option closes dropdown and updates label

- [ ] **Step 4: Final commit if any tweaks were made**

```bash
git add -p
git commit -m "fix: date filter smoke test tweaks"
```
