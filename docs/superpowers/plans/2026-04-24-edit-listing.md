# Edit Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authenticated listing owners to edit all fields of their existing listings — including category, location, dates, category-specific fields, tags, and photos (add/delete) — by reusing the existing `SubmitComponent` in an edit mode.

**Architecture:** The existing 3-step wizard (`SubmitComponent`) gains an optional `@Input() editListing` that pre-populates all form fields and switches create calls to update calls. `ProfileComponent` gains an Edit button that emits the listing up to `AppComponent`, which stores it in a signal and passes it down. Two new backend endpoints handle the update (`PATCH /api/v1/listings/{id}`) and photo deletion (`DELETE /api/v1/listings/{id}/photos/{photoId}`).

**Tech Stack:** Spring Boot 3.5 / JPA / PostgreSQL, Angular 17 standalone components / signals / `inject()`

---

## File Map

**Create:**
- `backend/src/main/java/com/christmaslightmap/dto/request/UpdateListingRequest.java`
- `backend/src/test/java/com/christmaslightmap/ListingEditTest.java`

**Modify:**
- `backend/src/main/java/com/christmaslightmap/service/ListingService.java` — add `updateListing()`, `deletePhoto()`
- `backend/src/main/java/com/christmaslightmap/controller/ListingController.java` — add PATCH + DELETE photo endpoints
- `frontend/src/app/models/listing.model.ts` — add `UpdateListingRequest` type
- `frontend/src/app/services/listing-api.service.ts` — add `update()`, `deletePhoto()`
- `frontend/src/app/app.component.ts` — add `editingListing` signal, wire edit flow
- `frontend/src/app/pages/profile/profile.component.ts` — add Edit button + `editListing` output
- `frontend/src/app/pages/submit/submit.component.ts` — add edit mode

---

## Task 1: UpdateListingRequest DTO

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/dto/request/UpdateListingRequest.java`

- [ ] **Step 1: Create the DTO**

```java
package com.christmaslightmap.dto.request;

import com.christmaslightmap.model.Category;
import com.christmaslightmap.model.DisplayType;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
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

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/dto/request/UpdateListingRequest.java
git commit -m "feat: add UpdateListingRequest DTO"
```

---

## Task 2: Service — updateListing() and deletePhoto()

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/service/ListingService.java`

Context: `ListingService` is annotated `@Transactional(readOnly = true)` at the class level. New write methods override this with `@Transactional`. The class already imports `GeometryFactory`, `Coordinate`, `Point`, `Collectors`, `List`, `HashSet`, and all relevant repositories. `DisplayPhotoRepository` is already injected as `displayPhotoRepository`.

- [ ] **Step 1: Add `updateListing()` method**

Add this method to `ListingService` after the existing `deleteListing()` method:

```java
@Transactional
public ListingResponse updateListing(Long userId, Long listingId, UpdateListingRequest request) {
    Listing listing = listingRepository.findById(listingId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
    if (!listing.getUser().getId().equals(userId)) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
    }

    Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(request.getLng(), request.getLat()));
    location.setSRID(4326);

    var tags = new HashSet<>(tagRepository.findAllById(
        request.getTagIds() != null ? request.getTagIds() : List.of()));

    listing.setTitle(request.getTitle());
    listing.setDescription(request.getDescription());
    listing.setAddress(request.getAddress());
    listing.setCity(request.getCity());
    listing.setState(request.getState());
    listing.setPostcode(request.getPostcode());
    listing.setLocation(location);
    listing.setCategory(request.getCategory());
    listing.setStartDatetime(request.getStartDatetime());
    listing.setEndDatetime(request.getEndDatetime());
    listing.setBestTime(request.getBestTime());
    listing.setDisplayType(request.getDisplayType());
    listing.setCuisineType(request.getCuisineType());
    listing.setOrganizer(request.getOrganizer());
    listing.setWebsiteUrl(request.getWebsiteUrl());
    listing.setPriceInfo(request.getPriceInfo());
    listing.setTags(tags);

    listing = listingRepository.save(listing);
    return ListingResponse.from(listing, displayPhotoRepository.findByDisplay_Id(listingId));
}
```

Also add this import at the top if not already present:
```java
import com.christmaslightmap.dto.request.UpdateListingRequest;
```

- [ ] **Step 2: Add `deletePhoto()` method**

Add this method directly after `updateListing()`:

```java
@Transactional
public void deletePhoto(Long userId, Long listingId, Long photoId) {
    Listing listing = listingRepository.findById(listingId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
    if (!listing.getUser().getId().equals(userId)) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
    }

    DisplayPhoto photo = displayPhotoRepository.findById(photoId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found"));

    boolean wasPrimary = photo.isPrimary();
    displayPhotoRepository.delete(photo);

    if (wasPrimary) {
        List<DisplayPhoto> remaining = displayPhotoRepository.findByDisplay_Id(listingId);
        if (!remaining.isEmpty()) {
            remaining.get(0).setPrimary(true);
            displayPhotoRepository.save(remaining.get(0));
        }
    }
}
```

Add this import at the top if not already present:
```java
import com.christmaslightmap.model.DisplayPhoto;
```

- [ ] **Step 3: Verify it compiles**

```bash
cd backend && mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/service/ListingService.java
git commit -m "feat: add updateListing and deletePhoto to ListingService"
```

---

## Task 3: Controller — PATCH + DELETE photo endpoints

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/controller/ListingController.java`

Context: `ListingController` already has `@RequestMapping("/api/v1/listings")`. All needed imports (`Authentication`, `ResponseEntity`, `ApiResponse`, `ListingResponse`, etc.) are already present. `listingService` is already injected.

- [ ] **Step 1: Add the PATCH endpoint**

Add this method after `getById()` in `ListingController`:

```java
@PatchMapping("/{id}")
public ResponseEntity<ApiResponse<ListingResponse>> update(
    @PathVariable Long id,
    @RequestBody UpdateListingRequest request,
    Authentication authentication
) {
    Long userId = (Long) authentication.getPrincipal();
    return ResponseEntity.ok(ApiResponse.success(listingService.updateListing(userId, id, request)));
}
```

Add this import at the top:
```java
import com.christmaslightmap.dto.request.UpdateListingRequest;
```

- [ ] **Step 2: Add the DELETE photo endpoint**

Add this method after the `deletePhoto` call site in `ListingController` (after the existing `@DeleteMapping("/{id}/upvote")`):

```java
@DeleteMapping("/{id}/photos/{photoId}")
public ResponseEntity<ApiResponse<Void>> deletePhoto(
    @PathVariable Long id,
    @PathVariable Long photoId,
    Authentication authentication
) {
    Long userId = (Long) authentication.getPrincipal();
    listingService.deletePhoto(userId, id, photoId);
    return ResponseEntity.ok(ApiResponse.success(null));
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd backend && mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/controller/ListingController.java
git commit -m "feat: add PATCH /listings/{id} and DELETE /listings/{id}/photos/{photoId}"
```

---

## Task 4: Integration Tests

**Files:**
- Create: `backend/src/test/java/com/christmaslightmap/ListingEditTest.java`

Context: Tests extend `BaseIntegrationTest` which spins up PostGIS via Testcontainers and mocks `S3Client`. `JwtService` can be autowired to generate real JWT tokens. Pass the token as `Cookie: jwt=<token>` header using `TestRestTemplate.exchange()` with an `HttpEntity`.

- [ ] **Step 1: Write the failing tests**

```java
package com.christmaslightmap;

import com.christmaslightmap.dto.request.UpdateListingRequest;
import com.christmaslightmap.model.*;
import com.christmaslightmap.repository.*;
import com.christmaslightmap.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ListingEditTest extends BaseIntegrationTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private ListingRepository listingRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JwtService jwtService;

    @AfterEach
    void cleanUp() {
        listingRepository.deleteAll();
        userRepository.deleteAll();
    }

    private Point point(double lng, double lat) {
        Point p = GF.createPoint(new Coordinate(lng, lat));
        p.setSRID(4326);
        return p;
    }

    private HttpHeaders authHeaders(User user) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(user));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private UpdateListingRequest baseUpdateRequest() {
        UpdateListingRequest req = new UpdateListingRequest();
        req.setCategory(Category.CHRISTMAS_LIGHTS);
        req.setTitle("Updated Title");
        req.setDescription("Updated description");
        req.setAddress("123 Main St");
        req.setCity("Denver");
        req.setState("CO");
        req.setPostcode("80202");
        req.setLat(39.752);
        req.setLng(-104.979);
        req.setStartDatetime(LocalDateTime.now().minusDays(1));
        req.setEndDatetime(LocalDateTime.now().plusDays(30));
        req.setTagIds(List.of());
        return req;
    }

    @Test
    void update_owner_returnsUpdatedListing() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb1").email("owner@test.com")
            .name("Owner").role(UserRole.USER).build());

        Listing listing = listingRepository.save(Listing.builder()
            .user(owner).title("Original Title").location(point(-104.979, 39.752))
            .category(Category.YARD_SALE)
            .startDatetime(LocalDateTime.now().minusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(30))
            .build());

        UpdateListingRequest req = baseUpdateRequest();
        HttpEntity<UpdateListingRequest> entity = new HttpEntity<>(req, authHeaders(owner));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/" + listing.getId(),
            HttpMethod.PATCH, entity, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Updated Title");
        assertThat(response.getBody()).contains("CHRISTMAS_LIGHTS");
    }

    @Test
    void update_nonOwner_returns403() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb2").email("owner2@test.com")
            .name("Owner2").role(UserRole.USER).build());
        User other = userRepository.save(User.builder()
            .provider("facebook").providerId("fb3").email("other@test.com")
            .name("Other").role(UserRole.USER).build());

        Listing listing = listingRepository.save(Listing.builder()
            .user(owner).title("Owner Listing").location(point(-104.979, 39.752))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().minusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(30))
            .build());

        HttpEntity<UpdateListingRequest> entity = new HttpEntity<>(baseUpdateRequest(), authHeaders(other));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/" + listing.getId(),
            HttpMethod.PATCH, entity, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void update_notFound_returns404() {
        User user = userRepository.save(User.builder()
            .provider("facebook").providerId("fb4").email("u4@test.com")
            .name("User4").role(UserRole.USER).build());

        HttpEntity<UpdateListingRequest> entity = new HttpEntity<>(baseUpdateRequest(), authHeaders(user));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/99999",
            HttpMethod.PATCH, entity, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && mvn test -Dtest=ListingEditTest -q
```

Expected: Tests should FAIL because the endpoints don't exist yet — but actually they exist from Task 3. The tests should PASS. If they fail, check the error output.

- [ ] **Step 3: Run full test suite**

```bash
cd backend && mvn test -q
```

Expected: All tests pass (14+ tests passing).

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/java/com/christmaslightmap/ListingEditTest.java
git commit -m "test: add ListingEditTest for update and delete-photo endpoints"
```

---

## Task 5: Frontend Model + API Service

**Files:**
- Modify: `frontend/src/app/models/listing.model.ts`
- Modify: `frontend/src/app/services/listing-api.service.ts`

- [ ] **Step 1: Add `UpdateListingRequest` type to `listing.model.ts`**

Add this after the `CreateListingRequest` interface (after line 139):

```typescript
export interface UpdateListingRequest {
  category: Category;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  lat: number;
  lng: number;
  startDatetime: string;
  endDatetime: string;
  priceInfo: string;
  bestTime: string;
  displayType: string;
  tagIds: number[];
  cuisineType: string;
  organizer: string;
  websiteUrl: string;
}
```

- [ ] **Step 2: Add `update()` and `deletePhoto()` to `listing-api.service.ts`**

First, update the import line at the top of `listing-api.service.ts` to include `UpdateListingRequest`:

```typescript
import {
  Listing, ListingSummary, Tag, Report,
  PagedResponse, SearchParams, CreateListingRequest, UpdateListingRequest
} from '../models/listing.model';
```

Then add these two methods after `create()`:

```typescript
update(id: number, request: UpdateListingRequest): Observable<Listing> {
  return this.http.patch<ApiResponse<Listing>>(`${this.base}/listings/${id}`, request, { withCredentials: true })
    .pipe(map(r => r.data));
}

deletePhoto(listingId: number, photoId: number): Observable<void> {
  return this.http.delete<void>(`${this.base}/listings/${listingId}/photos/${photoId}`, { withCredentials: true });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/models/listing.model.ts frontend/src/app/services/listing-api.service.ts
git commit -m "feat: add UpdateListingRequest type and update/deletePhoto API methods"
```

---

## Task 6: AppComponent — Edit Wiring

**Files:**
- Modify: `frontend/src/app/app.component.ts`

Context: `app.component.ts` currently has `screen`, `showSignIn`, `showSettings`, `selectedDisplay` signals. The `<app-submit>` binding is `(goHome)="screen.set('map')"` and `<app-profile>` has no edit output. We need to add `editingListing` signal, three new handler methods, and update the template bindings.

- [ ] **Step 1: Add `editingListing` signal and handler methods to the class**

In `app.component.ts`, add the signal after `selectedDisplay`:

```typescript
editingListing = signal<ListingSummary | null>(null);
```

Replace the `navigate()` method with this version that clears the edit state when leaving submit:

```typescript
navigate(screen: string) {
  if ((screen === 'submit' || screen === 'profile') && !this.authService.currentUser()) {
    this.showSignIn.set(true);
    return;
  }
  if (screen !== 'submit') this.editingListing.set(null);
  this.screen.set(screen as Screen);
  this.showSettings.set(false);
  this.location.replaceState(screen === 'map' ? '/' : '/' + screen);
}
```

Add these three new methods to the class:

```typescript
onSubmitDone() {
  this.editingListing.set(null);
  this.screen.set('map');
}

onSubmitCancel() {
  this.editingListing.set(null);
  this.screen.set('profile');
}

onEditListing(listing: ListingSummary) {
  this.editingListing.set(listing);
  this.screen.set('submit');
}
```

- [ ] **Step 2: Update the template bindings**

Replace the `<app-submit>` binding in the template:

```html
<app-submit *ngIf="screen() === 'submit'"
  [user]="authService.currentUser()"
  [editListing]="editingListing()"
  style="display:block;height:100%"
  (goHome)="onSubmitDone()"
  (cancel)="onSubmitCancel()"/>
```

Replace the `<app-profile>` binding:

```html
<app-profile *ngIf="screen() === 'profile'"
  [user]="authService.currentUser()"
  style="display:block;height:100%"
  (selectDisplay)="openDetail($event)"
  (editListing)="onEditListing($event)"/>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors (the new outputs on child components don't exist yet — this will error until Tasks 7 and 8 are done). If errors appear, note them and proceed to Task 7.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/app.component.ts
git commit -m "feat: wire editingListing signal and edit flow in AppComponent"
```

---

## Task 7: ProfileComponent — Edit Button

**Files:**
- Modify: `frontend/src/app/pages/profile/profile.component.ts`

Context: The profile component already has a Delete button with inline confirmation. The Edit button sits next to it but is hidden when the delete confirmation is showing for that listing. Both buttons position absolutely in the top-right of the card.

- [ ] **Step 1: Add `editListing` output to the class**

In `profile.component.ts`, add this output to the class (alongside `selectDisplay`):

```typescript
@Output() editListing = new EventEmitter<ListingSummary>();
```

- [ ] **Step 2: Add Edit button to the template**

In the "My Listings" section, find the existing Delete button block and replace it with both buttons. The existing block is:

```html
<!-- Delete button -->
<button *ngIf="deletingId() !== d.id" (click)="confirmDelete(d.id)"
        style="position:absolute;top:12px;right:12px;background:#fee2e2;border:none;
               color:#dc2626;border-radius:8px;padding:5px 10px;font-size:12px;
               font-weight:600;cursor:pointer">
  Delete
</button>
```

Replace it with:

```html
<!-- Edit + Delete buttons -->
<div *ngIf="deletingId() !== d.id"
     style="position:absolute;top:12px;right:12px;display:flex;gap:6px">
  <button (click)="editListing.emit(d)"
          style="background:#e0f2fe;border:none;color:#0369a1;border-radius:8px;
                 padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer">
    Edit
  </button>
  <button (click)="confirmDelete(d.id)"
          style="background:#fee2e2;border:none;color:#dc2626;border-radius:8px;
                 padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer">
    Delete
  </button>
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/pages/profile/profile.component.ts
git commit -m "feat: add Edit button to profile listing cards"
```

---

## Task 8: SubmitComponent — Edit Mode

**Files:**
- Modify: `frontend/src/app/pages/submit/submit.component.ts`

Context: `SubmitComponent` is a 3-step wizard. Adding edit mode means: (1) pre-populating `form` from `editListing` on init, (2) fetching the full listing for photos, (3) calling `update()` instead of `create()` in step 2, (4) showing existing photos with delete buttons in step 3, (5) changing header/button labels, (6) adding a Cancel button. The `form.startDatetime` and `form.endDatetime` are strings in `"YYYY-MM-DDTHH:mm"` format for the `datetime-local` input.

- [ ] **Step 1: Add imports and new signals/outputs to the class**

Update the import line at the top of `submit.component.ts`:

```typescript
import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from '@angular/core';
```

Update the model import to include `Photo`, `Listing`, and `UpdateListingRequest`:

```typescript
import { CATEGORY_LABELS, Category, Tag, Photo, Listing, ListingSummary, UpdateListingRequest } from '../../models/listing.model';
```

Add these new class members after `createdListingId`:

```typescript
@Input() editListing: ListingSummary | null = null;
@Output() cancel = new EventEmitter<void>();

existingPhotos = signal<Photo[]>([]);
photoError: string | null = null;
```

Change the class declaration to implement `OnInit`:

```typescript
export class SubmitComponent implements OnInit {
```

- [ ] **Step 2: Add `ngOnInit()` for edit pre-population**

Add a private helper and `ngOnInit` to the class (after the constructor):

```typescript
private toDatetimeLocal(dt: string | null): string {
  return dt ? dt.substring(0, 16) : '';
}

ngOnInit() {
  if (this.editListing) {
    const d = this.editListing;
    this.form.category = d.category;
    this.form.title = d.title;
    this.form.description = '';
    this.form.city = d.city;
    this.form.state = d.state;
    this.form.lat = d.lat;
    this.form.lng = d.lng;
    this.form.startDatetime = this.toDatetimeLocal(d.startDatetime);
    this.form.endDatetime = this.toDatetimeLocal(d.endDatetime);
    this.form.priceInfo = d.priceInfo ?? '';
    this.form.displayType = d.displayType ?? 'DRIVE_BY';
    this.form.cuisineType = d.cuisineType ?? '';
    this.form.organizer = d.organizer ?? '';
    this.form.websiteUrl = d.websiteUrl ?? '';
    this.form.tagIds = d.tags.map(t => t.id);
    this.createdListingId.set(d.id);

    this.listingApi.getById(d.id).subscribe({
      next: (full: Listing) => {
        this.form.description = full.description ?? '';
        this.form.address = full.address ?? '';
        this.form.postcode = full.postcode ?? '';
        this.form.bestTime = full.bestTime ?? '';
        this.existingPhotos.set(full.photos ?? []);
      },
    });
  }
}
```

- [ ] **Step 3: Replace `submitListing()` to handle both create and update**

Replace the existing `private submitListing()` method with:

```typescript
private submitListing() {
  this.submitting = true;
  this.error = null;

  const payload = {
    category: this.form.category as Category,
    title: this.form.title,
    description: this.form.description,
    address: this.form.address,
    city: this.form.city,
    state: this.form.state,
    postcode: this.form.postcode,
    lat: this.form.lat,
    lng: this.form.lng,
    startDatetime: this.form.startDatetime,
    endDatetime: this.form.endDatetime,
    priceInfo: this.form.priceInfo,
    bestTime: this.form.bestTime,
    displayType: this.form.displayType,
    tagIds: this.form.tagIds,
    cuisineType: this.form.cuisineType,
    organizer: this.form.organizer,
    websiteUrl: this.form.websiteUrl,
  };

  const call = this.editListing
    ? this.listingApi.update(this.editListing.id, payload as UpdateListingRequest)
    : this.listingApi.create(payload);

  call.subscribe({
    next: listing => {
      this.createdListingId.set(listing.id);
      this.submitting = false;
      this.step.set('photo');
    },
    error: () => {
      this.submitting = false;
      this.error = this.editListing ? 'Update failed. Please try again.' : 'Submission failed. Please try again.';
    },
  });
}
```

- [ ] **Step 4: Add `removeExistingPhoto()` method**

Add this method to the class (after `toggleTag()`):

```typescript
removeExistingPhoto(photoId: number) {
  const listingId = this.createdListingId()!;
  this.listingApi.deletePhoto(listingId, photoId).subscribe({
    next: () => {
      this.existingPhotos.update(photos => photos.filter(p => p.id !== photoId));
      this.photoError = null;
    },
    error: () => { this.photoError = 'Could not remove photo. Try again.'; },
  });
}
```

- [ ] **Step 5: Update the template — header, step indicator, cancel button**

In the template, find the header section (currently `"Add a Listing"`) and replace it:

```html
<!-- Header -->
<div style="margin-bottom:28px">
  <div style="font-weight:800;font-size:22px;color:#0f172a;margin-bottom:4px">
    {{editListing ? 'Edit Listing' : 'Add a Listing'}}
  </div>
  <div style="font-size:13.5px;color:#64748b">Share an event or attraction with the community</div>
</div>
```

In step 1 (location), add a Cancel button at the bottom of the location fields (before the navigation buttons). Add it inside the `*ngIf="step() === 'location'"` block at the end:

```html
<div *ngIf="editListing" style="margin-top:8px;text-align:center">
  <button (click)="cancel.emit()"
          style="background:none;border:none;color:#94a3b8;font-size:13px;
                 cursor:pointer;text-decoration:underline">
    Cancel editing
  </button>
</div>
```

- [ ] **Step 6: Update the template — photo step existing photos**

In the photo step (`*ngIf="step() === 'photo'"`), add the existing photos section BEFORE the drop zone div:

```html
<!-- Existing photos (edit mode) -->
<div *ngIf="existingPhotos().length > 0" style="margin-bottom:16px">
  <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px">
    Current Photos
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <div *ngFor="let p of existingPhotos()" style="position:relative">
      <img [src]="p.url"
           style="width:80px;height:80px;object-fit:cover;border-radius:8px;display:block"/>
      <button (click)="removeExistingPhoto(p.id)"
              style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;
                     background:#dc2626;color:white;border:none;border-radius:50%;
                     cursor:pointer;font-size:13px;line-height:1;display:flex;
                     align-items:center;justify-content:center">
        ×
      </button>
    </div>
  </div>
  <div *ngIf="photoError" style="color:#dc2626;font-size:12px;margin-top:6px">
    {{photoError}}
  </div>
</div>
```

- [ ] **Step 7: Update the template — confirmation screen and step 2 button label**

Find the confirmation screen title `"Listing Submitted!"` and replace with:

```html
<div style="font-weight:800;font-size:24px;color:#0f172a;margin-bottom:10px">
  {{editListing ? 'Listing Updated!' : 'Listing Submitted!'}}
</div>
```

Find the step 2 button label in the navigation area. The current ternary is:
```
{{step() === 'photo' ? 'Done' : step() === 'details' ? (submitting ? 'Submitting…' : 'Submit & Continue') : (geocoding ? 'Locating…' : 'Continue')}}
```

Replace with:
```
{{step() === 'photo' ? 'Done' : step() === 'details' ? (submitting ? (editListing ? 'Updating…' : 'Submitting…') : (editListing ? 'Update & Continue' : 'Submit & Continue')) : (geocoding ? 'Locating…' : 'Continue')}}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/pages/submit/submit.component.ts
git commit -m "feat: add edit mode to SubmitComponent"
```

---

## Final Check

- [ ] **Run frontend build**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: Build successful, 0 errors

- [ ] **Run backend tests**

```bash
cd backend && mvn test -q
```

Expected: All tests pass

- [ ] **Push to main**

```bash
git push origin main
```
