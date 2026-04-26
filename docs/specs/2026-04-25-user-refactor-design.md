# User & Host Service Refactor — Design Spec
**Date:** 2026-04-25

## Goal

Reorganize user and host responsibilities across frontend services and backend controllers/services so each unit has a single, clear purpose. The current `ListingApiService` handles listing, host, user, and admin operations. The current backend `UserController`/`UserService` owns host-listing and handle logic that belongs in the host layer.

---

## Frontend Service Boundaries

### `ListingApiService` (trimmed)
Listing operations only:
- `searchListings()`, `getListingById()`, `createListing()`, `updateListing()`, `deleteListing()`
- `upvoteListing()`, `removeUpvote()`, `getUpvotedListings()`
- `reportListing()`
- `getTags()`

### `HostService` (new)
Everything host-related:
- `searchHosts()` — public host search (`GET /api/v1/hosts?q=`)
- `getHostListings(userId)` — public listings by user id (`GET /api/v1/hosts/{userId}/listings`)
- `getHostListingsByHandle(handle)` — public listings by handle (`GET /api/v1/hosts/handle/{handle}`)
- `createHost()`, `updateHost()`, `deleteHost()`, `transferHost()`
- `uploadHostAvatar()`

### `UserService` (new)
Current user's profile management:
- `getMyHosts()` — fetch current user's own hosts (`GET /api/v1/hosts/me`)
- `updateDisplayName()` — update user-level display name (`PATCH /api/v1/users/me`)

### `AdminService` (new)
Admin operations:
- `getReports()`, `updateReport()`

### `AuthService` (unchanged)
Auth state only — `currentUser` signal, `isLoggedIn`, `isAdmin`, `login()`, `logout()`, `init()`.

---

## Backend Changes

### `UserController` — endpoints removed/kept
| Action | Endpoint | Change |
|--------|----------|--------|
| Get user's listings | `GET /api/v1/users/{userId}/listings` | Removed — moved to HostController |
| Get by handle | `GET /api/v1/users/handle/{handle}` | Removed — moved to HostController |
| Search hosts | `GET /api/v1/users/search?q=` | Removed — consolidated into `GET /api/v1/hosts?q=` |
| Update handle | `PATCH /api/v1/users/me/handle` | Removed — handle is host-only |
| Update display name | `PATCH /api/v1/users/me` | Kept |

### `HostController` — endpoints gained
| Endpoint | Source |
|----------|--------|
| `GET /api/v1/hosts/{userId}/listings` | Moved from UserController |
| `GET /api/v1/hosts/handle/{handle}` | Moved from UserController |
| `GET /api/v1/hosts?q=` | Already exists; absorbs `/users/search` logic |

### `UserService` — methods removed/kept
| Method | Change |
|--------|--------|
| `getHostListings()` | Moved to HostService |
| `getHostListingsByHandle()` | Moved to HostService |
| `searchHosts()` | Moved to HostService |
| `updateHandle()` | Removed |
| `generateUniqueHandle()` | Kept — still used by OAuth2UserService at login |
| `updateDisplayName()` | Kept |

### `HostService` — methods gained
- `getHostListings(userId)` (from UserService)
- `getHostListingsByHandle(handle)` (from UserService)
- `searchHosts(q)` (from UserService)

---

## Component Updates

### `ProfileComponent`
Currently injects only `ListingApiService`. After refactor injects:
- `UserService` — `getMyHosts()`, `updateDisplayName()`
- `HostService` — host CRUD, avatar upload, transfer
- `ListingApiService` — `getUpvotedListings()` only

No changes to signals or internal logic — only injected services and call sites change.

### `HostProfileComponent`
Moves `getHostListingsByHandle()` call from `ListingApiService` → `HostService`.

### Admin component(s)
Move report calls from `ListingApiService` → `AdminService`.

---

## Out of Scope
- Removing `User.handle` from the entity/database (separate follow-up)
- Changes to `AuthService`, `JwtService`, `OAuth2UserService`, or security config
- ProfileComponent signal consolidation
