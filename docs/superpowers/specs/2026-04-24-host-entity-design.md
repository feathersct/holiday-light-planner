# Host Entity & Ownership Transfer Design

## Goal

Allow any user to create and manage one or more named host profiles (e.g. a food truck brand), submit listings under those hosts, and transfer full ownership of a host to another user when they're ready to manage it themselves.

## Architecture

Introduce a first-class `Host` entity separate from `User`. A user owns zero or more hosts. Listings optionally belong to a host via a nullable `host_id` FK. Transfer is a single `owner_user_id` update on the host — listings follow automatically because edit permission is checked via host ownership, not `listing.user_id`.

**Tech Stack:** Spring Boot 3.5 / JPA / Flyway (backend), Angular 17 signals (frontend), Cloudflare R2 (avatar storage)

---

## Data Model

### New table: `hosts`

| column | type | constraints |
|---|---|---|
| id | bigserial | PK |
| owner_user_id | bigint | FK → users, not null |
| handle | varchar(30) | unique not null |
| display_name | varchar(100) | not null |
| avatar_url | varchar(500) | nullable |
| created_at | timestamp | not null, default now() |

Handle uniqueness is global — a handle cannot exist in both `users.handle` and `hosts.handle`. The application enforces this at the service layer before insert/update.

### Modified table: `listings`

Add column `host_id bigint` — nullable FK → hosts. Existing rows default to null and continue to work via `user_id` as before.

### Edit permission rule

If `listing.host_id` is non-null, the requesting user must own that host (`hosts.owner_user_id = current_user_id`). Otherwise the existing `listing.user_id = current_user_id` check applies.

---

## Backend API

All new endpoints are under `/api/v1/hosts`. Owner-only endpoints require the authenticated user to be `hosts.owner_user_id`.

| method | path | auth | description |
|---|---|---|---|
| `POST` | `/api/v1/hosts` | required | Create a host. Body: `{ displayName, handle }`. Returns `HostResponse`. |
| `GET` | `/api/v1/hosts/me` | required | List all hosts owned by the current user. Returns `List<HostResponse>`. |
| `PATCH` | `/api/v1/hosts/{id}` | owner | Update `displayName` and/or `handle`. Returns updated `HostResponse`. |
| `POST` | `/api/v1/hosts/{id}/avatar` | owner | Upload avatar image (multipart). Stores to R2, sets `avatar_url`. Returns updated `HostResponse`. |
| `DELETE` | `/api/v1/hosts/{id}` | owner | Delete host. Rejected (409) if any active listings exist for this host. |
| `POST` | `/api/v1/hosts/{id}/transfer` | owner | Transfer ownership. Body: `{ targetHandle }`. Returns 204. |
| `GET` | `/api/v1/hosts/handle/{handle}` | public | Resolve host profile by handle. Returns `HostListingsResponse`. |

### Handle resolution for `/host/{handle}` URLs

`GET /api/v1/users/handle/{handle}` (the existing endpoint) checks the `hosts` table first by handle, then falls back to `users`. This preserves all existing `/host/{handle}` URLs without any frontend changes.

### Submit listing changes

`POST /api/v1/listings` and `PUT /api/v1/listings/{id}` accept an optional `hostId` field. If provided, the backend verifies the current user owns that host before associating the listing.

### `HostResponse` DTO

```java
{
  long id;
  String handle;
  String displayName;
  String avatarUrl;       // nullable
  int listingCount;
  LocalDateTime createdAt;
}
```

---

## Frontend

### Profile page — "Your Hosts" section

Appears above personal listings. Contains:

- A **"Create Host"** button that opens an inline form: display name, handle (with live preview `eventmapster.com/host/your-handle`), and optional avatar upload.
- A card per owned host showing: avatar (or initials fallback), display name, handle, active listing count, and three actions — **Edit**, **Transfer**, **Delete**.

**Edit:** expands an inline form on the card — same fields as creation plus avatar upload. Handle field checks availability on blur (debounced `GET /api/v1/hosts/handle/{handle}` check). Save calls `PATCH /api/v1/hosts/{id}`.

**Transfer:** opens a modal with a single handle input. On valid input, shows the target user's name and avatar for confirmation. Clicking Transfer calls `POST /api/v1/hosts/{id}/transfer`. On success, the host card is removed from the list immediately.

**Delete:** disabled with tooltip "Remove all listings before deleting" when the host has active listings. Otherwise shows a confirm prompt before calling `DELETE /api/v1/hosts/{id}`.

### Submit form — "Post as" field

Added to the details step, below the category selector. A dropdown showing:

- "Personal" (always present)
- One entry per host the user owns

Defaults to "Personal" if the user has no hosts; defaults to the first host if one or more exist. The selected host's `id` is sent as `hostId` in the submit payload. Not shown to unauthenticated users.

### Host profile page

No structural changes. The `/host/{handle}` URL continues to resolve via the existing `users/handle/{handle}` backend endpoint, which now checks `hosts` first. The `HostListingsResponse` shape is unchanged. `HostUserResponse` only exposes public fields: `id`, `name`, `displayName`, `avatarUrl`, `handle`. These all exist on the `Host` entity. The backend's `users/handle/{handle}` resolver populates a `HostUserResponse` from whichever entity matched — User or Host — using the same public fields.

---

## Transfer Flow

1. Current owner clicks **Transfer** on a host card in their profile.
2. A modal appears with a handle search input.
3. On valid handle, the target user's name and avatar are shown for confirmation.
4. Owner clicks **Transfer** — `POST /api/v1/hosts/{id}/transfer` with `{ targetHandle }`.
5. Backend: find target user by handle → update `hosts.owner_user_id` → return 204.
6. Frontend: removes host card from owner's list. No action required by recipient — host immediately appears in their hosts list on next load.

---

## Edge Cases & Constraints

| scenario | behavior |
|---|---|
| Transfer to self | 400 — "You already own this host" |
| Transfer to non-existent handle | 404 — "No user found with that handle" |
| Delete host with active listings | 409 — "Remove all active listings before deleting" |
| Handle collision (create or edit) | 409 — checked across both `users.handle` and `hosts.handle` |
| Avatar on transfer | Stays with host entity; new owner inherits as-is |
| "Post as" after transfer | Transferred host disappears from dropdown immediately |
| Existing user handle URLs | `/host/clayton` still resolves if `clayton` is a user handle and no host has it |
| Listings without host_id | Unaffected; remain under submitting user's personal account |

---

## Database Migrations

- **V19__hosts_table.sql** — create `hosts` table with unique index on `handle`
- **V20__listings_host_id.sql** — add nullable `host_id` FK to `listings`
