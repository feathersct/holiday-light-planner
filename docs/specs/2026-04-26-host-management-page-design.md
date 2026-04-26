# Host Management Page — Design Spec

## Goal

Give each host a dedicated management page where the owner can edit host properties and manage all of that host's listings. The Profile page becomes a clean landing page — user info, display name, and a clickable list of hosts.

## Architecture

The app uses signal-based screen navigation (no Angular Router). A new screen state `'manage-host'` is added alongside the existing `'map'`, `'profile'`, `'submit'`, etc. `AppComponent` gains a `selectedManagedHost = signal<HostEntity | null>(null)`. When the user taps a host card on the Profile page, the app sets this signal and switches to `'manage-host'`. The back button on the host page switches back to `'profile'` and clears the signal.

**New frontend file:** `frontend/src/app/pages/manage-host/manage-host.component.ts`

**Updated frontend files:**
- `frontend/src/app/app.component.ts` — new screen type, `selectedManagedHost` signal, navigation handler
- `frontend/src/app/pages/profile/profile.component.ts` — host cards become navigation items, inline edit/delete/transfer removed
- `frontend/src/app/services/host.service.ts` — new `getHostManagedListings(hostId)` method

**Backend changes:**
- `HostController` / `HostService` — fix `GET /api/v1/hosts/{hostId}/listings`
- `ListingController` / `ListingService` — new `PATCH /api/v1/listings/{id}/active`
- `SecurityConfig` — remove public permit for `GET /api/v1/hosts/*/listings`
- `ListingRepository` — new `findAllByHostId(Long hostId)` query

---

## Profile Page Changes

### Display name section
- Label: **"Display name"** (was "Business / host name")
- Hint: **"Shown for any community listings. Does not affect listings posted under a host."**

### Your Hosts section
- The inline edit/delete/transfer/avatar forms are removed.
- Each host renders as a clickable card: avatar (or initials), display name, handle, listing count.
- Tapping a card emits a `manageHost(host: HostEntity)` event → `AppComponent` navigates to `'manage-host'`.
- **"+ Create Host"** button and create form remain on this page unchanged.

### Everything else
- User profile card and upvoted listings section are unchanged.

---

## Host Management Page (`ManageHostComponent`)

### Inputs / Outputs
- `@Input() host: HostEntity` — the host being managed
- `@Output() back = new EventEmitter<void>()` — navigates back to Profile
- `@Output() addListing = new EventEmitter<HostEntity>()` — opens submit form with host pre-selected

### Header
Back button + host display name as page title.

### Host Settings Section
Editable fields for display name, handle, and avatar upload — same logic currently in the Profile inline edit form, moved here. Save button. Transfer and Delete actions at the bottom of this section with their existing confirmation flows (transfer by handle, delete blocked if active listings exist).

### Current & Upcoming Listings
All listings where `endDatetime` is in the future or `isActive` is true.

**"+ Add Listing"** button at top — emits `addListing` event, app opens submit form with this host pre-selected.

Each listing card shows:
- Title
- Category + city
- Active/Inactive status badge
- Start and end dates
- Actions: **Edit** (opens submit form with listing pre-loaded), **Deactivate/Reactivate** (calls `PATCH /api/v1/listings/{id}/active`), **Delete** (with inline confirmation)

### Past Listings
Collapsible section below current listings. Collapsed by default. Label: **"Past listings"** with count badge.

Listings where `endDatetime` is in the past. Same card format, but only **Delete** action is available.

---

## Backend Changes

### 1. Fix `GET /api/v1/hosts/{hostId}/listings`

**Before:** Path variable named `userId`, delegates to `HostService.getHostListings(userId)` which returns an empty listing array (stub).

**After:**
- Path variable renamed to `hostId` (Host entity ID, not User ID).
- Requires authentication.
- `HostService` verifies the authenticated user owns that host (via `findOwned`).
- Returns all listings for that host via new `ListingRepository.findAllByHostId(Long hostId)` query — no date or status filter.
- Response type: existing `HostListingsResponse` (host user info + full listing list).
- `SecurityConfig`: remove the `permitAll` rule for `GET /api/v1/hosts/*/listings` — it becomes covered by the catch-all `authenticated()` rule.

**New repository method:**
```java
List<Listing> findByHostIdOrderByStartDatetimeDesc(Long hostId);
```

### 2. New `PATCH /api/v1/listings/{id}/active`

New endpoint on `ListingController`. Requires authentication. Verifies the authenticated user owns the host that owns the listing (not an admin check — owner check).

**Request body:**
```java
// SetListingActiveRequest.java
public class SetListingActiveRequest {
    private boolean active;
}
```

**Behavior:** Sets `listing.isActive = request.isActive()`, saves, returns `ListingSummaryResponse`.

**Security:** Covered by existing `anyRequest().authenticated()` — no explicit permit rule needed.

---

## Frontend Service Change

`HostService.getHostManagedListings(hostId: number): Observable<HostListingsResponse>`

```typescript
getHostManagedListings(hostId: number): Observable<HostListingsResponse> {
  return this.http.get<ApiResponse<HostListingsResponse>>(
    `${this.base}/hosts/${hostId}/listings`, { withCredentials: true }
  ).pipe(map(r => r.data));
}
```

---

## Navigation Flow

```
Profile page
  → tap host card → screen = 'manage-host', selectedManagedHost = host
      → back button → screen = 'profile', selectedManagedHost = null
      → "+ Add Listing" → screen = 'submit', preselectedHostId = host.id
      → "Edit" on listing → screen = 'submit', editingListing = listing
```

---

## What Is NOT Changing

- Public host profile (`HostProfileComponent`, `GET /api/v1/hosts/handle/{handle}`) — unchanged, still shows active/upcoming listings only.
- Submit form — unchanged, already supports pre-selected host and listing editing.
- Admin listing management — unchanged, admin endpoints are separate.
- Create host flow — stays on Profile page.
