# URL Filter State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encode the map's active filters and current center into the URL as query parameters so the page is deep-linkable and the URL stays in sync as the user interacts with the map.

**Architecture:** AppComponent parses `window.location.search` on init into an `InitialFilters` object and passes it to MapComponent via a new `@Input()`. MapComponent applies those values during `initMap()` and emits a `FilterState` via a new `@Output() filtersChanged` on every map move and filter change. AppComponent listens to that output and calls `location.replaceState()` to keep the URL in sync.

**Tech Stack:** Angular 17 standalone components, Angular `Location` service, `URLSearchParams` (browser built-in).

---

## File Map

| File | Change |
|---|---|
| `frontend/src/app/models/listing.model.ts` | Add `InitialFilters` and `FilterState` interfaces |
| `frontend/src/app/pages/map/map.component.ts` | Add `@Input() initialFilters`, `@Output() filtersChanged`, dynamic `radius`, apply filters on init, emit on change/move |
| `frontend/src/app/app.component.ts` | Parse URL on init, pass `initialFilters`, handle `filtersChanged`, update URL |

---

### Task 1: Add InitialFilters and FilterState interfaces

**Files:**
- Modify: `frontend/src/app/models/listing.model.ts`

- [ ] **Step 1: Add both interfaces after the `SearchParams` interface (around line 137)**

Open `frontend/src/app/models/listing.model.ts`. After the closing `}` of `SearchParams`, add:

```typescript
export interface InitialFilters {
  category?: Category;
  lat?: number;
  lng?: number;
  radius?: number;
  tags?: string[];
}

export interface FilterState {
  category: Category | '';
  tags: string[];
  lat: number;
  lng: number;
  radius: number;
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
git commit -m "feat: add InitialFilters and FilterState interfaces"
```

---

### Task 2: Update MapComponent — apply initial filters, emit filter state

**Files:**
- Modify: `frontend/src/app/pages/map/map.component.ts`

This task adds the `@Input() initialFilters` and `@Output() filtersChanged` members, replaces the hardcoded `radiusMiles: 10` with a dynamic `radius` property, applies initial filters before geolocation in `initMap()`, and emits the current filter state at the start of every `loadDisplays()` call.

- [ ] **Step 1: Add imports for the new interfaces**

In `map.component.ts` line 12, the import from `listing.model` currently ends with `...Tag } from '../../models/listing.model';`. Add `InitialFilters` and `FilterState` to that import:

```typescript
import { ListingSummary, CATEGORY_COLORS, CATEGORY_LABELS, Category, formatDateRange, isUpcoming, Tag, InitialFilters, FilterState } from '../../models/listing.model';
```

- [ ] **Step 2: Add the new `@Input()`, `@Output()`, and `radius` property to the class**

In the class body after the existing outputs (around line 382), add:

```typescript
@Input() initialFilters: InitialFilters | null = null;
@Output() filtersChanged = new EventEmitter<FilterState>();
```

After `selectedCategory: Category | '' = '';` (around line 395), add:

```typescript
radius = 10;
```

- [ ] **Step 3: Add the `emitFiltersChanged()` private helper**

Add this method just before `loadDisplays()` (around line 524):

```typescript
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

- [ ] **Step 4: Call `emitFiltersChanged()` at the top of `loadDisplays()` and use `this.radius`**

Replace the opening of `loadDisplays()`:

```typescript
loadDisplays() {
  if (!this.map) return;
  this.emitFiltersChanged();
  const center = this.map.getCenter();
  const tagIds = this.activeTags.map(name => this.availableTags.find(t => t.name === name)?.id).filter((id): id is number => !!id);
  this.loading = true;
  this.listingApi.search({
    lat: center.lat,
    lng: center.lng,
    radiusMiles: this.radius,
    category: this.selectedCategory || undefined,
    tags: tagIds.length ? tagIds : undefined,
  }).subscribe({
    next: page => {
      this.listings = page.content;
      this.loading = false;
      this.renderMarkers();
    },
    error: () => { this.loading = false; },
  });
}
```

- [ ] **Step 5: Apply initial filters and conditionally skip geolocation in `initMap()`**

Replace the entire `private initMap()` method with the following. The key changes are: (a) apply `initialFilters` to `selectedCategory`, `activeTags`, and `radius` before the map is created; (b) use `initialFilters.lat/lng` as the initial view if present; (c) skip geolocation when URL lat/lng are provided; (d) set `this.locating = false` immediately when URL coordinates are used.

```typescript
private initMap() {
  if (this.map || !this.mapContainer?.nativeElement) return;
  const cfg = TILE_LAYERS[this.mapTiles] || TILE_LAYERS['light'];
  const f = this.initialFilters;
  const hasUrlLocation = f?.lat != null && f?.lng != null;

  if (f?.category) this.selectedCategory = f.category;
  if (f?.tags?.length) this.activeTags = [...f.tags];
  if (f?.radius != null) this.radius = f.radius;

  const initCenter: [number, number] = hasUrlLocation ? [f!.lat!, f!.lng!] : [39.752, -104.979];
  if (hasUrlLocation) this.locating = false;

  this.map = L.map(this.mapContainer.nativeElement, { zoomControl: false }).setView(initCenter, 13);
  L.control.zoom({ position: 'bottomright' }).addTo(this.map);
  this.tileLayer = L.tileLayer(cfg.url, { attribution: cfg.attr, maxZoom: 19 }).addTo(this.map);
  this.renderMarkers();
  this.map.on('click', () => { this.selected = null; if (this.isMobile) this.snapKey = 'peek'; });
  this.map.on('moveend', () => this.loadDisplays());
  this.map.invalidateSize();
  this.loadDisplays();
  if (!hasUrlLocation && navigator.geolocation) {
    const cached = sessionStorage.getItem('hlp_location_found');
    if (cached) {
      const [lat, lng] = cached.split(',').map(Number);
      this.map?.setView([lat, lng], 13);
    } else {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          sessionStorage.setItem('hlp_location_found', `${latitude},${longitude}`);
          this.map?.setView([latitude, longitude], 13);
          this.locating = false;
        },
        () => { this.locating = false; },
        { timeout: 15000, maximumAge: 60000 }
      );
    }
  }
}
```

- [ ] **Step 6: Verify the build compiles**

```bash
npm run build 2>&1 | tail -6
```
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/pages/map/map.component.ts
git commit -m "feat: add initialFilters input, filtersChanged output, and dynamic radius to MapComponent"
```

---

### Task 3: Update AppComponent — parse URL params, wire bindings, sync URL

**Files:**
- Modify: `frontend/src/app/app.component.ts`

- [ ] **Step 1: Add new imports**

In `app.component.ts` line 4, the import from `listing.model` is:
```typescript
import { ListingSummary, HostUser } from './models/listing.model';
```

Replace it with:
```typescript
import { ListingSummary, HostUser, InitialFilters, FilterState, Category, CATEGORY_LABELS } from './models/listing.model';
```

- [ ] **Step 2: Add the `initialFilters` property to the class**

After `editSource = signal<'profile' | 'admin'>('profile');` (around line 162), add:

```typescript
initialFilters: InitialFilters | null = null;
```

- [ ] **Step 3: Add `parseInitialFilters()` private helper**

Add this method just before `ngOnInit()`:

```typescript
private parseInitialFilters(): InitialFilters | null {
  const params = new URLSearchParams(window.location.search);
  const result: InitialFilters = {};
  const cat = params.get('category');
  if (cat && Object.keys(CATEGORY_LABELS).includes(cat)) result.category = cat as Category;
  const lat = parseFloat(params.get('lat') ?? '');
  const lng = parseFloat(params.get('lng') ?? '');
  if (!isNaN(lat) && !isNaN(lng)) { result.lat = lat; result.lng = lng; }
  const radius = parseInt(params.get('radius') ?? '', 10);
  if (!isNaN(radius) && radius >= 1 && radius <= 100) result.radius = radius;
  const tags = params.get('tags');
  if (tags) result.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
  return Object.keys(result).length > 0 ? result : null;
}
```

- [ ] **Step 4: Call `parseInitialFilters()` in `ngOnInit()`**

Replace `ngOnInit()`:

```typescript
ngOnInit() {
  this.authService.init();
  this.initialFilters = this.parseInitialFilters();
  const path = this.location.path();
  if (path.startsWith('/submit')) this.screen.set('submit');
  else if (path.startsWith('/profile')) this.screen.set('profile');
  else if (path.startsWith('/admin')) this.screen.set('admin');
  else if (path.startsWith('/hosts')) this.location.replaceState('/');
  else if (path.startsWith('/host')) this.location.replaceState('/');
}
```

- [ ] **Step 5: Add `onFiltersChanged()` method**

Add this method after `isUpvoted()`:

```typescript
onFiltersChanged(state: FilterState) {
  this.initialFilters = null;
  if (this.screen() !== 'map') return;
  const params = new URLSearchParams();
  if (state.category) params.set('category', state.category);
  if (state.tags.length) params.set('tags', state.tags.join(','));
  params.set('lat', state.lat.toFixed(5));
  params.set('lng', state.lng.toFixed(5));
  if (state.radius !== 10) params.set('radius', String(state.radius));
  this.location.replaceState('/', params.toString());
}
```

- [ ] **Step 6: Wire the bindings in the template**

In the template, replace the `<app-map .../>` block (lines 51–57):

```html
<app-map *ngIf="screen() === 'map'"
  [user]="authService.currentUser()"
  [mapTiles]="authService.mapTiles()"
  [initialFilters]="initialFilters"
  style="display:block;height:100%"
  (needAuth)="showSignIn.set(true)"
  (viewDetails)="openDetail($event)"
  (upvoteToggle)="upvoteService.toggle($event)"
  (filtersChanged)="onFiltersChanged($event)"/>
```

- [ ] **Step 7: Verify the build compiles**

```bash
npm run build 2>&1 | tail -6
```
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 8: Manual smoke test**

Start the dev server:
```bash
npm start
```

Open the app and test these scenarios:

1. **Pre-filter via URL:** Open `http://localhost:4200/?category=YARD_SALE&lat=35.5051&lng=-80.8771` — the map should center on Charlotte, NC with Yard Sales pre-selected in the category filter chips.

2. **URL updates on pan:** Pan the map and check the browser address bar — `lat` and `lng` should update to the new center.

3. **URL updates on category change:** Click a category chip — `category` param should appear/change in the address bar.

4. **URL updates on tag toggle:** Click Tags → toggle a tag — `tags` param should appear in the address bar.

5. **Invalid params ignored:** Open `/?category=FAKE&lat=abc&lng=xyz&radius=999` — map should load normally with no filters applied.

6. **No geolocation prompt on URL with lat/lng:** When lat/lng are in the URL, the "Finding your location…" spinner should not appear.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/app.component.ts
git commit -m "feat: parse URL filter params on load and keep URL in sync as filters change"
```
