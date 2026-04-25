# Listings — Host-Only Ownership Design

## Goal

Remove `user_id` from `listings` entirely. Listings belong to hosts only; ownership traces to users via `hosts.owner_user_id`.

## Architecture

Every listing already has a `host_id` (guaranteed by V22 backfill). This change drops the now-redundant `user_id` column, removes all user-based ownership branches, and strips user attribution fields from API responses. The profile page "My Listings" tab is removed — listing management lives in each host's section.

## Data Layer

**Migration V23:**
```sql
ALTER TABLE listings DROP COLUMN user_id;
```

**`Listing.java`:** Remove `@ManyToOne User user` field and its `@JoinColumn`.

Upvotes (`upvotes.user_id`) and reports (`reports.user_id`) are unchanged — those columns record the acting user, not the listing owner.

## Service Layer

**`ListingService`:**
- `createListing(Long userId, CreateListingRequest)`: remove `userRepository.findById(userId)` and `.user(user)` from the `Listing` builder. Host resolution (`hostId` or default) is unchanged.
- `updateListing`, `deleteListing`, `deletePhoto`: ownership check simplifies to `listing.getHost().getOwner().getId().equals(userId)` — remove the host-or-user branch.
- `getMyListings(Long userId)`: removed entirely.
- `getUpvotedListings(Long userId)`: unchanged.
- `findOrCreateDefaultHost`: signature changes to take `Long userId`; loads the `User` internally only when creating a new host (for display name and handle generation).

**`ListingController`:** Remove `GET /api/v1/listings/mine` endpoint.

## API Response Layer

**`ListingResponse`:** Remove fields `submittedBy`, `submittedByName`, `submittedByAvatarUrl`, `submittedByHandle`. `resolveHostName` simplifies to `listing.getHost().getDisplayName()`.

**`ListingRepository` native search queries (all 4):** Drop `JOIN users u ON u.id = d.user_id` and remove the two user columns (`u.display_name`, `u.name AS user_name`) from the SELECT. Update `mapRowToSummary` column indices accordingly (rows 18 and 19 are removed; everything after shifts).

**`ListingSummaryResponse`:** No user fields to remove — already clean.

## Frontend

**`listing.model.ts`:** Remove `submittedBy`, `submittedByName`, `submittedByAvatarUrl`, `submittedByHandle` from the `Listing` interface.

**`display-detail.component.ts`:** `onViewHost()` removes the user fallback — emits `hostId`/`hostHandle` unconditionally (every listing has a host). The "By [name]" byline continues to use `resolvedHostName`.

**`profile.component.ts`:** Remove the "My Listings" tab, its signals (`myListings`, `loadingListings`), and the `getMyListings()` API call in `ngOnInit`.

**`listing-api.service.ts`:** Remove the `getMyListings()` method.

**`submit.component.ts`, `host-search.component.ts`:** No changes.

## What Does Not Change

- Host management (create, update, delete, transfer, avatar)
- Upvotes — recorded against `user_id`, unrelated to listing ownership
- Reports — `user_id` is the reporter, not the owner
- Map search queries — `host_id IS NOT NULL` filter stays
- Admin listing management
- `GET /listings/upvoted` endpoint
