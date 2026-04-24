# Host Handle (Shareable URL) — Design Spec

**Date:** 2026-04-24

## Overview

Give every host a short, shareable URL (`eventmapster.com/host/smithfamily`) so they can post it on Facebook, their website, or anywhere. The page shows their profile and all upcoming events — no login required.

Handles are auto-generated from the host's display name (or name) on first login. Hosts can change their handle in the Profile page.

---

## Handle Rules

- Lowercase letters, numbers, and hyphens only (`[a-z0-9-]`)
- 3–30 characters
- Unique across all users
- Auto-generated from `displayName` (fallback: `name`) by lowercasing, replacing non-alphanumeric runs with a single hyphen, and trimming leading/trailing hyphens
- On conflict, append `-2`, `-3`, etc. up to `-99`
- Truncate to 28 characters before appending the suffix to leave room

**Examples:**
- "Smith Family Lights" → `smith-family-lights`
- "Joe's BBQ Truck!" → `joes-bbq-truck`
- "Smith Family Lights" (conflict) → `smith-family-lights-2`

---

## Backend Changes

### Migration: `V17__add_user_handle.sql`

```sql
ALTER TABLE users ADD COLUMN handle VARCHAR(30) UNIQUE;

UPDATE users
SET handle = lower(regexp_replace(
  regexp_replace(coalesce(display_name, name), '[^a-zA-Z0-9]+', '-', 'g'),
  '^-|-$', '', 'g'
));
```

The backfill may produce duplicates for existing users. The service layer's `generateUniqueHandle` method handles uniqueness at signup; for the backfill migration, we tolerate the rare duplicate by appending the user ID: if the simple slug already exists, use `{slug}-{id}`.

Use a more robust backfill in the migration:

```sql
ALTER TABLE users ADD COLUMN handle VARCHAR(30);

UPDATE users u
SET handle = CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM users u2
    WHERE u2.id != u.id
    AND lower(regexp_replace(regexp_replace(coalesce(u2.display_name, u2.name), '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g'))
      = lower(regexp_replace(regexp_replace(coalesce(u.display_name, u.name), '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g'))
  )
  THEN lower(regexp_replace(regexp_replace(coalesce(display_name, name), '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g'))
  ELSE lower(regexp_replace(regexp_replace(coalesce(display_name, name), '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g')) || '-' || id::text
END;

ALTER TABLE users ALTER COLUMN handle SET NOT NULL;
CREATE UNIQUE INDEX users_handle_unique ON users(handle);
```

---

### User Model

Add to `User.java`:
```java
@Column(name = "handle", nullable = false, length = 30, unique = true)
private String handle;
```

---

### HostUserResponse DTO

Add `handle` field:
```java
private String handle;
```

Update `from(User user)`:
```java
.handle(user.getHandle())
```

---

### New Endpoint: `GET /api/v1/users/handle/{handle}`

Public (no auth). Returns `HostListingsResponse` (same shape as `/{userId}/listings`).

Returns `404` if handle not found.

Add to `UserController`:
```java
@GetMapping("/handle/{handle}")
public ResponseEntity<ApiResponse<HostListingsResponse>> getHostByHandle(@PathVariable String handle) {
    return ResponseEntity.ok(ApiResponse.success(userService.getHostListingsByHandle(handle)));
}
```

Add to `UserService`:
```java
public HostListingsResponse getHostListingsByHandle(String handle) {
    User user = userRepository.findByHandle(handle)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Host not found"));
    return getHostListings(user.getId());
}
```

Add to `UserRepository`:
```java
Optional<User> findByHandle(String handle);
```

---

### New Endpoint: `PATCH /api/v1/users/me/handle`

Authenticated. Validates format and uniqueness, updates handle.

Request DTO `UpdateHandleRequest`:
```java
@NotBlank
@Size(min = 3, max = 30)
@Pattern(regexp = "^[a-z0-9-]+$", message = "Handle must contain only lowercase letters, numbers, and hyphens")
private String handle;
```

Returns `HostUserResponse` (updated user). Returns `409 Conflict` if handle is taken.

Add to `UserController`:
```java
@PatchMapping("/me/handle")
public ResponseEntity<ApiResponse<HostUserResponse>> updateHandle(
    Authentication authentication,
    @Valid @RequestBody UpdateHandleRequest request) {
    Long userId = (Long) authentication.getPrincipal();
    return ResponseEntity.ok(ApiResponse.success(userService.updateHandle(userId, request)));
}
```

Add to `UserService`:
```java
public HostUserResponse updateHandle(Long userId, UpdateHandleRequest request) {
    if (userRepository.existsByHandleAndIdNot(request.getHandle(), userId)) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Handle already taken");
    }
    User user = userRepository.findById(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    user.setHandle(request.getHandle());
    return HostUserResponse.from(userRepository.save(user));
}
```

Add to `UserRepository`:
```java
boolean existsByHandleAndIdNot(String handle, Long id);
```

---

### Auto-generate Handle at Login

In the OAuth2 success handler (where users are created/updated), generate a handle if the user has none:

```java
private String generateUniqueHandle(String displayName, String fallbackName) {
    String base = (displayName != null ? displayName : fallbackName)
        .toLowerCase()
        .replaceAll("[^a-z0-9]+", "-")
        .replaceAll("^-|-$", "");
    if (base.length() < 3) base = base + "user";
    String slug = base.length() > 28 ? base.substring(0, 28) : base;
    if (!userRepository.existsByHandle(slug)) return slug;
    for (int i = 2; i <= 99; i++) {
        String candidate = slug + "-" + i;
        if (!userRepository.existsByHandle(candidate)) return candidate;
    }
    return slug + "-" + System.currentTimeMillis() % 10000;
}
```

Add to `UserRepository`:
```java
boolean existsByHandle(String handle);
```

---

### Security Config

Add public access for the new handle endpoint:
```java
.requestMatchers(HttpMethod.GET, "/api/v1/users/handle/**").permitAll()
```

---

### ListingResponse — Add `submittedByHandle`

`ListingResponse` currently has `submittedByName` and `submittedByAvatarUrl`. Add:
```java
private String submittedByHandle;
```

Populate from `user.getHandle()` in the service.

---

## Frontend Changes

### `listing.model.ts`

Add `handle` to `HostUser`:
```typescript
export interface HostUser {
  id: number;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  handle: string | null;
}
```

Add `submittedByHandle` to `Listing`:
```typescript
submittedByHandle: string | null;
```

Add `handle` to `HostListingsResponse` user field (via `HostUser`).

---

### `listing-api.service.ts`

Add method:
```typescript
getHostListingsByHandle(handle: string): Observable<HostListingsResponse> {
  return this.http.get<ApiResponse<HostListingsResponse>>(
    `${this.base}/users/handle/${handle}`, { withCredentials: true }
  ).pipe(map(r => r.data));
}

updateHandle(handle: string): Observable<HostSearchResult> {
  return this.http.patch<ApiResponse<HostSearchResult>>(
    `${this.base}/users/me/handle`, { handle }, { withCredentials: true }
  ).pipe(map(r => r.data));
}
```

---

### `app.component.ts`

**URL parsing on load:** Parse `/host/{handle}` in `ngOnInit` and load the host profile directly:

```typescript
} else if (path.startsWith('/host/')) {
  const handle = path.split('/')[2];
  if (handle) {
    this.listingApi.getHostListingsByHandle(handle).subscribe({
      next: resp => {
        this.viewingHost.set({ id: resp.user.id, name: resp.user.name, displayName: resp.user.displayName, avatarUrl: resp.user.avatarUrl, handle: resp.user.handle });
        this.screen.set('host');
      },
      error: () => this.location.replaceState('/'),
    });
  }
}
```

**`openHostProfile`:** Update URL to `/host/{handle}`:
```typescript
openHostProfile(host: HostUser) {
  this.selectedDisplay.set(null);
  this.viewingHost.set(host);
  this.screen.set('host');
  this.location.replaceState('/host/' + (host.handle ?? host.id));
}
```

**On navigate away from host:** Reset URL to `/` (already done via `location.replaceState('/')` for 'hosts' and 'host' paths).

---

### `display-detail.component.ts`

Pass `submittedByHandle` in `onViewHost()`:
```typescript
onViewHost() {
  const d = this.fullDisplay();
  if (!d) return;
  this.viewHost.emit({ id: d.submittedBy, name: d.submittedByName, displayName: null, avatarUrl: d.submittedByAvatarUrl, handle: d.submittedByHandle });
}
```

---

### Profile Page — Handle Edit

Add a handle edit section to `profile.component.ts`, styled identically to the existing display name edit. Shows current handle pre-filled. On save, calls `updateHandle`. Shows `409` error as "That handle is already taken."

---

## Files Changed

| File | Change |
|---|---|
| `backend/.../db/migration/V17__add_user_handle.sql` | Add `handle` column, backfill, unique index |
| `backend/.../model/User.java` | Add `handle` field |
| `backend/.../dto/response/HostUserResponse.java` | Add `handle` field |
| `backend/.../dto/response/ListingResponse.java` | Add `submittedByHandle` field |
| `backend/.../dto/request/UpdateHandleRequest.java` | New DTO |
| `backend/.../repository/UserRepository.java` | Add `findByHandle`, `existsByHandle`, `existsByHandleAndIdNot` |
| `backend/.../controller/UserController.java` | Add `GET /handle/{handle}`, `PATCH /me/handle` |
| `backend/.../service/UserService.java` | Add `getHostListingsByHandle`, `updateHandle`, `generateUniqueHandle` |
| `backend/.../config/SecurityConfig.java` | Permit `GET /api/v1/users/handle/**` |
| `backend/.../security/OAuth2UserService.java` | Auto-generate handle at login |
| `frontend/.../models/listing.model.ts` | Add `handle` to `HostUser`, `submittedByHandle` to `Listing` |
| `frontend/.../services/listing-api.service.ts` | Add `getHostListingsByHandle`, `updateHandle` |
| `frontend/.../app.component.ts` | Parse `/host/{handle}` on load; update `openHostProfile` URL |
| `frontend/.../display-detail/display-detail.component.ts` | Pass `submittedByHandle` in `onViewHost` |
| `frontend/.../pages/profile/profile.component.ts` | Add handle edit section |

---

## Out of Scope

- Custom vanity domains per host
- Handle history / redirect from old handles after a change
- Showing the handle publicly on the host profile card (just the URL matters)
