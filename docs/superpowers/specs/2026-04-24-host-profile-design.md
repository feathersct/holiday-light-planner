# Host Profile Feature — Design Spec

**Goal:** Show the host's name on each event detail, and let users tap it to see all that host's upcoming (not-yet-ended) events on a dedicated profile screen.

**Architecture:** Add submitter name/avatar to the existing `ListingResponse` DTO; expose a new public `GET /api/v1/users/{userId}/listings` endpoint returning host info + upcoming listings in a single response; add a `HostProfileComponent` full screen to the Angular app wired through `AppComponent`.

**Tech Stack:** Spring Boot 3.5 / JPA / Angular 17 signals / standalone components

---

## Backend

### 1. `ListingResponse` — add host fields

Add two fields to `ListingResponse`:
- `submittedByName: String` — the user's display name
- `submittedByAvatarUrl: String` — nullable, Facebook profile photo URL

The `from(Listing, List<DisplayPhoto>)` factory method already holds a reference to `listing.getUser()`, so no extra query is needed. Set both fields from `listing.getUser().getName()` and `listing.getUser().getAvatarUrl()`.

### 2. New DTOs

**`HostUserResponse`**
```java
public class HostUserResponse {
    private Long id;
    private String name;
    private String avatarUrl;
}
```

**`HostListingsResponse`**
```java
public class HostListingsResponse {
    private HostUserResponse user;
    private List<ListingSummaryResponse> listings;
}
```

### 3. `ListingRepository` — new query

```java
@Query("SELECT l FROM Listing l WHERE l.user.id = :userId AND l.isActive = true AND l.endDatetime > :now ORDER BY l.startDatetime ASC")
List<Listing> findUpcomingByUserId(@Param("userId") Long userId, @Param("now") LocalDateTime now);
```

### 4. `UserController` — new public endpoint

```
GET /api/v1/users/{userId}/listings
```

- No `@PreAuthorize` — public access, no authentication required
- Returns `ApiResponse<HostListingsResponse>`
- Resolves the user by ID (404 if not found), maps to `HostUserResponse`
- Calls `listingRepository.findUpcomingByUserId(userId, LocalDateTime.now())`
- Maps listings to `ListingSummaryResponse` using the same builder pattern as `AdminService.getAllListings()`
- Lives in a new `UserController` class at `controller/UserController.java`

---

## Frontend

### 1. `listing.model.ts` — additions

Add to the `Listing` interface (extends `ListingSummary`):
```typescript
submittedByName: string;
submittedByAvatarUrl: string | null;
```

Add new interfaces:
```typescript
export interface HostUser {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface HostListingsResponse {
  user: HostUser;
  listings: ListingSummary[];
}
```

### 2. `listing-api.service.ts` — new method

```typescript
getHostListings(userId: number): Observable<HostListingsResponse> {
  return this.http.get<ApiResponse<HostListingsResponse>>(
    `${this.base}/users/${userId}/listings`, { withCredentials: true }
  ).pipe(map(r => r.data));
}
```

### 3. `DisplayDetailComponent` — host byline

Below the event title, add a tappable "By [Host Name]" line:
```html
<div (click)="onViewHost()" style="font-size:13px;color:var(--accent);cursor:pointer;font-weight:600">
  By {{fullDisplay()!.submittedByName}}
</div>
```

Add `@Output() viewHost = new EventEmitter<HostUser>()`.

`onViewHost()` emits `{ id: fullDisplay()!.submittedBy, name: fullDisplay()!.submittedByName, avatarUrl: fullDisplay()!.submittedByAvatarUrl }`.

### 4. `HostProfileComponent` (new file)

`frontend/src/app/pages/host-profile/host-profile.component.ts`

Inputs:
- `@Input() host!: HostUser`

Outputs:
- `@Output() back = new EventEmitter<void>()`
- `@Output() viewDetails = new EventEmitter<ListingSummary>()`

On init: calls `listingApi.getHostListings(host.id)` and populates `listings` signal.

Layout:
- Header: back arrow button (`←`) on the left, "Events" label centered
- Profile section: circular avatar (60px, Facebook photo or initials fallback using `getInitials(host.name)`), host name in large bold text, subtitle "X upcoming events"
- Scrollable list of event cards — same card style as `ProfileComponent`. Each card is tappable; emits `viewDetails`.
- Empty state: "No upcoming events from this host"
- Loading state: "Loading…"

### 5. `AppComponent` — wiring

Add `'host'` to the `Screen` type.

Add signal:
```typescript
viewingHost = signal<HostUser | null>(null);
```

Add method:
```typescript
openHostProfile(host: HostUser) {
  this.selectedDisplay.set(null);  // close detail modal
  this.viewingHost.set(host);
  this.screen.set('host');
}
```

Add to template:
```html
<app-host-profile *ngIf="screen() === 'host'"
  [host]="viewingHost()!"
  style="display:block;height:100%"
  (back)="navigate('map')"
  (viewDetails)="openDetail($event)"/>
```

Update `<app-display-detail>` binding:
```html
(viewHost)="openHostProfile($event)"
```

Update `navigate()`: when leaving `'host'`, clear `viewingHost`.

---

## Data Flow

```
User taps event on map
  → DisplayDetailComponent opens, fetches GET /listings/{id}
  → Response now includes submittedByName, submittedByAvatarUrl
  → "By [Name]" appears below title

User taps "By [Name]"
  → viewHost emits HostUser { id, name, avatarUrl }
  → AppComponent closes detail modal, sets viewingHost, navigates to 'host' screen

HostProfileComponent mounts with [host] input
  → Calls GET /api/v1/users/{userId}/listings
  → Response: { user: {id, name, avatarUrl}, listings: [...] }
  → Renders avatar + name + event cards

User taps an event card
  → viewDetails emits ListingSummary
  → AppComponent opens DisplayDetailComponent for that listing

User taps Back
  → back emits → AppComponent navigates to 'map'
```

---

## Error Handling

- `UserController`: 404 if userId doesn't exist
- `HostProfileComponent`: if API call fails, show "Could not load events. Try again." with a retry button
- If host has no upcoming events: show empty state "No upcoming events from this host"

---

## Not In Scope

- Pagination on the host profile (show all upcoming events — hosts won't have hundreds)
- Host bio / editable profile
- Following a host / notifications
- Showing the host name on map markers or search result cards (can add later)
- Host name in `ListingSummaryResponse` (not needed for this feature)
