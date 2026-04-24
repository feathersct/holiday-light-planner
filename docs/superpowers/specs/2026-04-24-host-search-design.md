# Host Search Feature — Design Spec

**Date:** 2026-04-24

## Overview

Allow users to discover hosts (food trucks, markets, organizers) by name and navigate to their event listings. Hosts can set a custom business name at the profile level, optionally overridden per listing.

---

## Data Model

### `users` table
Add column:
- `display_name VARCHAR(100)` — nullable. Host's custom business name, set by the user on their profile.

### `listings` table
Add column:
- `host_name VARCHAR(100)` — nullable. Per-listing override of the host's display name.

### Host name resolution order
When displaying the name of a host for a listing:
1. `listings.host_name` (per-listing override)
2. `users.display_name` (profile-level business name)
3. `users.name` (Facebook OAuth name — always present)

---

## Backend API

### New: `GET /api/v1/users/search?q={query}`
- Public endpoint (no auth required).
- Returns up to 10 users whose `display_name` OR `name` contains `q` (case-insensitive `ILIKE '%q%'`).
- Filtered to users who have at least one active (`is_active = true`) upcoming listing (`end_datetime > now()`).
- Response: `ApiResponse<List<HostUserResponse>>` — each item has `id`, `name`, `displayName`, `avatarUrl`.

### New: `PATCH /api/v1/users/me`
- Authenticated. Updates the calling user's `display_name`.
- Request body: `{ "displayName": "string or empty" }`.
- Empty string is stored as `null`.
- Value is trimmed and capped at 100 characters before saving.

### Modified: `POST /api/v1/listings` and `PATCH /api/v1/listings/{id}`
- Accept optional `hostName` field in request body.
- Trimmed and capped at 100 characters before saving.

### Modified: `ListingSummaryResponse` and `ListingResponse`
- Add `hostName` field (nullable String) — populated from `listings.host_name`.
- Frontend applies resolution order client-side using `submittedByName` (already present) as the final fallback.

### No changes to `GET /api/v1/users/{userId}/listings`
- Already returns host user info and their upcoming listings. Works as-is.

---

## Frontend

### New: `HostSearchComponent` at `/hosts`
- New route and standalone Angular component.
- Initial state: search bar with prompt text — "Search for a food truck, market, or host by name."
- Autocomplete triggers after 2+ characters, debounced 300ms.
- Calls `GET /api/v1/users/search?q={query}`.
- Dropdown shows up to 10 results: avatar + resolved display name.
- Selecting a result navigates to `/host/:userId` (existing host profile page).
- No results: shows "No hosts found" inline in the dropdown.
- On request failure: silently hides the dropdown (no error shown while typing).

### Modified: Profile page (`ProfileComponent`)
- Add "Display name" text input to existing profile settings.
- Label: "Business / host name (optional)" with helper text explaining it appears on your listings.
- Saves via `PATCH /api/v1/users/me`.

### Modified: Submit + Edit listing forms (`SubmitComponent`)
- Add optional "Host name" field, shown for all categories.
- Label: "Host name for this listing (optional — overrides your profile name)".
- Maps to `hostName` in the request body.

### Modified: Host byline display
- `DisplayDetailComponent` and `DisplayCardComponent` resolve the display name using the priority order:
  `listing.hostName` → `listing.submittedByName` resolved via user's `displayName` → `listing.submittedByName`.
- Since `ListingSummaryResponse` now includes `hostName`, the frontend picks `hostName` if present, otherwise falls back to `submittedByName`.

### Modified: Bottom tab bar (`BottomTabBarComponent`)
- Add a "Hosts" tab linking to `/hosts` on mobile alongside existing tabs.
- Also add a "Hosts" link in the desktop navbar.

---

## Error Handling

- `display_name` and `host_name` trimmed and capped at 100 chars on the backend before saving.
- `PATCH /users/me` with empty string stores `null` (clears display name).
- Autocomplete search failure suppresses dropdown silently.
- No results in autocomplete shows "No hosts found" — not an error state.
- Users without active upcoming listings are excluded from search results.

---

## Out of Scope
- Per-listing host name override for *future* listings beyond this feature (already included above).
- Host "verified" badges or business profiles.
- Searching by listing title or keyword.
