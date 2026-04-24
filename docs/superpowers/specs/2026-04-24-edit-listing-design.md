# Edit Listing Design

## Goal

Allow authenticated users to edit any field of their own listings, including category, location, dates, category-specific fields, and photos (add new / delete existing).

## Architecture

Reuse `SubmitComponent` for editing by adding an optional `editListing` input. When populated, the component pre-fills all form fields, replaces create API calls with update calls, and shows existing photos in the photo step with delete controls. Two new backend endpoints handle the update and photo deletion. No new Angular component is created.

## Tech Stack

- Angular 17 standalone components, signals, `inject()`
- Spring Boot 3.5, JPA, existing `ListingController` / `ListingService`
- Nominatim geocoding (same as create flow — re-geocodes when address changes)

---

## Backend

### New DTO: `UpdateListingRequest`

Same fields as `CreateListingRequest` — all required for the PATCH call since the frontend sends the complete current state:

```java
public class UpdateListingRequest {
    private Category category;
    private String title;
    private String description;
    private String address;
    private String city;
    private String state;
    private String postcode;
    private double lat;
    private double lng;
    private LocalDateTime startDatetime;
    private LocalDateTime endDatetime;
    private String priceInfo;
    private String bestTime;
    private DisplayType displayType;
    private List<Long> tagIds;
    private String cuisineType;
    private String organizer;
    private String websiteUrl;
}
```

### New Endpoint: `PATCH /api/v1/listings/{id}`

- Requires authentication
- Returns 403 if `listing.user.id != authenticatedUserId`
- Returns 404 if listing not found
- Updates all fields from `UpdateListingRequest` on the existing `Listing` entity
- Rebuilds the JTS `Point` from the incoming lat/lng
- Replaces the tag set entirely with the new `tagIds`
- Returns `ApiResponse<ListingResponse>`

### New Endpoint: `DELETE /api/v1/listings/{id}/photos/{photoId}`

- Requires authentication
- Returns 403 if the listing doesn't belong to the authenticated user
- Deletes the `DisplayPhoto` row (hard delete — triggers decrement `photo_count`)
- If the deleted photo had `isPrimary = true` and other photos remain, sets the earliest remaining photo as primary
- Returns `ApiResponse<Void>`

### `ListingService` changes

- New method `updateListing(Long userId, Long listingId, UpdateListingRequest request)`
- New method `deletePhoto(Long userId, Long listingId, Long photoId)` — handles primary reassignment

### `ListingController` changes

- Add `@PatchMapping("/{id}")` calling `listingService.updateListing()`
- Add `@DeleteMapping("/{id}/photos/{photoId}")` calling `listingService.deletePhoto()`

---

## Frontend

### `listing.model.ts`

Add `UpdateListingRequest` type (same shape as `CreateListingRequest`).

### `listing-api.service.ts`

Two new methods:

```typescript
update(id: number, request: UpdateListingRequest): Observable<Listing>
// PATCH /api/v1/listings/{id}

deletePhoto(listingId: number, photoId: number): Observable<void>
// DELETE /api/v1/listings/{listingId}/photos/{photoId}
```

### `app.component.ts`

- Add `editingListing = signal<ListingSummary | null>(null)`
- Pass `[editListing]="editingListing()"` to `<app-submit>`
- Handle new `(editListing)` output from `ProfileComponent`: set `editingListing` signal and navigate to `'submit'` screen
- Clear `editingListing` when navigating away from submit (goHome or cancel)

### `profile.component.ts`

- Add `@Output() editListing = new EventEmitter<ListingSummary>()`
- Add "Edit" button next to the existing "Delete" button on each listing card
- "Edit" button is hidden while delete confirmation is showing

### `submit.component.ts`

**New input:**
```typescript
@Input() editListing: ListingSummary | null = null;
```

**Init behavior when `editListing` is non-null:**
- Pre-populate `form` from the `ListingSummary` fields on component init
- Call `listingApi.getById(editListing.id)` to load the full `Listing` with photos; store in `existingPhotos` signal
- Set `createdListingId` to `editListing.id` (so photo upload targets the correct listing)

**Template changes:**
- Header: "Edit Listing" when editing, "Add a Listing" when creating
- Step 2 submit button: "Update" when editing, "Submit & Continue" when creating
- Success screen message: "Listing Updated!" when editing
- Add `@Output() cancel = new EventEmitter<void>()` — "Cancel" button on step 1 when editing (navigates back to profile without changes)

**Step 2 logic:**
- When editing, call `listingApi.update(editListing.id, request)` instead of `listingApi.create(request)`

**Photo step when editing:**
- Show `existingPhotos()` as a horizontal row of thumbnails, each with a ×  button
- Tapping × calls `listingApi.deletePhoto(listingId, photo.id)` and removes from `existingPhotos` signal
- The existing upload area remains below for adding a new photo
- If no existing photos and no new file selected, "Done" still advances (photos remain optional)

---

## Authorization Rules

- Only the listing owner can edit or delete photos. 403 for anyone else.
- Admins are not given edit access through this flow (they have the admin panel for hard deletes; edit is owner-only).

## Error Handling

- Update fails: show inline error "Update failed. Please try again." (same pattern as create)
- Photo delete fails: show brief error below the photo row; photo remains in the list
- `getById` fails on edit init: show "Could not load listing details" and disable the form

---

## What Is Not In Scope

- Admins editing listings on behalf of users
- Bulk photo reordering or setting a new primary photo manually (primary is auto-assigned to oldest remaining)
- Editing upvote counts or active status (those remain admin-only)
