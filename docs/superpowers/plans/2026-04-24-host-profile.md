# Host Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the submitting user's name on each event detail modal and let any user tap it to view that host's upcoming events on a dedicated full-screen profile.

**Architecture:** Add `submittedByName`/`submittedByAvatarUrl` to `ListingResponse`; create a `UserService` + `UserController` exposing `GET /api/v1/users/{userId}/listings` returning host info + upcoming events in one response; add a `HostProfileComponent` full screen wired through `AppComponent`.

**Tech Stack:** Spring Boot 3.5 / JPA / Angular 17 signals / standalone components / TestContainers integration tests

---

## File Map

**Backend — create:**
- `backend/src/main/java/com/christmaslightmap/dto/response/HostUserResponse.java`
- `backend/src/main/java/com/christmaslightmap/dto/response/HostListingsResponse.java`
- `backend/src/main/java/com/christmaslightmap/service/UserService.java`
- `backend/src/main/java/com/christmaslightmap/controller/UserController.java`
- `backend/src/test/java/com/christmaslightmap/HostProfileTest.java`

**Backend — modify:**
- `backend/src/main/java/com/christmaslightmap/dto/response/ListingResponse.java` — add `submittedByName`, `submittedByAvatarUrl`
- `backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java` — add `findUpcomingByUserId` query
- `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java` — permit `GET /api/v1/users/*/listings`

**Frontend — create:**
- `frontend/src/app/pages/host-profile/host-profile.component.ts`

**Frontend — modify:**
- `frontend/src/app/models/listing.model.ts` — add `submittedByName`/`submittedByAvatarUrl` to `Listing`; add `HostUser`, `HostListingsResponse`
- `frontend/src/app/services/listing-api.service.ts` — add `getHostListings()`
- `frontend/src/app/shared/display-detail/display-detail.component.ts` — add host byline + `viewHost` output
- `frontend/src/app/app.component.ts` — add `'host'` screen, `viewingHost` signal, full wiring

---

### Task 1: Backend DTOs + ListingResponse host fields

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/HostUserResponse.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/HostListingsResponse.java`
- Modify: `backend/src/main/java/com/christmaslightmap/dto/response/ListingResponse.java`

- [ ] **Step 1: Create `HostUserResponse`**

```java
package com.christmaslightmap.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class HostUserResponse {
    private Long id;
    private String name;
    private String avatarUrl;
}
```

- [ ] **Step 2: Create `HostListingsResponse`**

```java
package com.christmaslightmap.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class HostListingsResponse {
    private HostUserResponse user;
    private List<ListingSummaryResponse> listings;
}
```

- [ ] **Step 3: Add host fields to `ListingResponse`**

Add two fields after `private Long submittedBy;`:
```java
private String submittedByName;
private String submittedByAvatarUrl;
```

In the `from()` factory, add after `.submittedBy(listing.getUser().getId())`:
```java
.submittedByName(listing.getUser().getName())
.submittedByAvatarUrl(listing.getUser().getAvatarUrl())
```

- [ ] **Step 4: Verify compilation**

Run from `backend/`:
```bash
mvn compile -q
```
Expected: no output (clean compile).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/dto/response/HostUserResponse.java \
        backend/src/main/java/com/christmaslightmap/dto/response/HostListingsResponse.java \
        backend/src/main/java/com/christmaslightmap/dto/response/ListingResponse.java
git commit -m "feat: add HostUserResponse, HostListingsResponse DTOs; add host name/avatar to ListingResponse"
```

---

### Task 2: Repository query + UserService

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java`
- Create: `backend/src/main/java/com/christmaslightmap/service/UserService.java`

- [ ] **Step 1: Add `findUpcomingByUserId` to `ListingRepository`**

Add this import at the top if not present: `import java.time.LocalDateTime;`

Add after the existing `findByUserIdAndIsActiveTrue` method:

```java
@Query("SELECT l FROM Listing l LEFT JOIN FETCH l.tags WHERE l.user.id = :userId AND l.isActive = true AND l.endDatetime > :now ORDER BY l.startDatetime ASC")
List<Listing> findUpcomingByUserId(@Param("userId") Long userId, @Param("now") LocalDateTime now);
```

The `LEFT JOIN FETCH l.tags` prevents a `LazyInitializationException` when mapping tags outside a transaction.

- [ ] **Step 2: Create `UserService`**

```java
package com.christmaslightmap.service;

import com.christmaslightmap.dto.response.*;
import com.christmaslightmap.model.Listing;
import com.christmaslightmap.model.User;
import com.christmaslightmap.repository.DisplayPhotoRepository;
import com.christmaslightmap.repository.ListingRepository;
import com.christmaslightmap.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final ListingRepository listingRepository;
    private final DisplayPhotoRepository displayPhotoRepository;

    public HostListingsResponse getHostListings(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<Listing> listings = listingRepository.findUpcomingByUserId(userId, LocalDateTime.now());

        List<Long> ids = listings.stream().map(Listing::getId).collect(Collectors.toList());
        Map<Long, String> primaryUrls = ids.isEmpty() ? Map.of() :
            displayPhotoRepository.findPrimaryByDisplayIdIn(ids).stream()
                .collect(Collectors.toMap(p -> p.getDisplay().getId(), DisplayPhoto::getUrl));

        List<ListingSummaryResponse> summaries = listings.stream()
            .map(l -> ListingSummaryResponse.builder()
                .id(l.getId())
                .title(l.getTitle())
                .city(l.getCity())
                .state(l.getState())
                .lat(l.getLocation().getY())
                .lng(l.getLocation().getX())
                .upvoteCount(l.getUpvoteCount())
                .photoCount(l.getPhotoCount())
                .category(l.getCategory())
                .displayType(l.getDisplayType() != null ? l.getDisplayType().name() : null)
                .primaryPhotoUrl(primaryUrls.get(l.getId()))
                .tags(l.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
                .isActive(l.isActive())
                .startDatetime(l.getStartDatetime())
                .endDatetime(l.getEndDatetime())
                .priceInfo(l.getPriceInfo())
                .cuisineType(l.getCuisineType())
                .organizer(l.getOrganizer())
                .websiteUrl(l.getWebsiteUrl())
                .build())
            .collect(Collectors.toList());

        return HostListingsResponse.builder()
            .user(HostUserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .avatarUrl(user.getAvatarUrl())
                .build())
            .listings(summaries)
            .build();
    }
}
```

- [ ] **Step 3: Verify compilation**

```bash
mvn compile -q
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java \
        backend/src/main/java/com/christmaslightmap/service/UserService.java
git commit -m "feat: add findUpcomingByUserId query and UserService.getHostListings()"
```

---

### Task 3: UserController + SecurityConfig

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/controller/UserController.java`
- Modify: `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java`

- [ ] **Step 1: Create `UserController`**

```java
package com.christmaslightmap.controller;

import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.HostListingsResponse;
import com.christmaslightmap.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/{userId}/listings")
    public ResponseEntity<ApiResponse<HostListingsResponse>> getHostListings(@PathVariable Long userId) {
        return ResponseEntity.ok(ApiResponse.success(userService.getHostListings(userId)));
    }
}
```

- [ ] **Step 2: Permit the new endpoint in `SecurityConfig`**

In `SecurityConfig.java`, inside `authorizeHttpRequests`, add this line before `.anyRequest().authenticated()`:

```java
.requestMatchers(HttpMethod.GET, "/api/v1/users/*/listings").permitAll()
```

The full `authorizeHttpRequests` block should read:
```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/oauth2/**", "/login/**", "/error").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/v1/displays/mine").authenticated()
    .requestMatchers(HttpMethod.GET, "/api/v1/displays/upvoted").authenticated()
    .requestMatchers(HttpMethod.GET, "/api/v1/displays/**").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/v1/listings/mine").authenticated()
    .requestMatchers(HttpMethod.GET, "/api/v1/listings/upvoted").authenticated()
    .requestMatchers(HttpMethod.GET, "/api/v1/listings/**").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/v1/tags").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/v1/users/*/listings").permitAll()
    .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
    .anyRequest().authenticated()
)
```

- [ ] **Step 3: Verify compilation**

```bash
mvn compile -q
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/controller/UserController.java \
        backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java
git commit -m "feat: add UserController GET /api/v1/users/{userId}/listings; permit in SecurityConfig"
```

---

### Task 4: Backend integration test

**Files:**
- Create: `backend/src/test/java/com/christmaslightmap/HostProfileTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.christmaslightmap;

import com.christmaslightmap.model.*;
import com.christmaslightmap.repository.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class HostProfileTest extends BaseIntegrationTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private ListingRepository listingRepository;
    @Autowired private UserRepository userRepository;

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

    @Test
    void getHostListings_returnsOnlyUpcomingActiveListings() {
        User host = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-host1")
            .email("host@test.com").name("Test Host")
            .role(UserRole.USER).build());

        listingRepository.save(Listing.builder()
            .user(host).title("Upcoming Event")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .build());

        listingRepository.save(Listing.builder()
            .user(host).title("Expired Event")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().minusDays(10))
            .endDatetime(LocalDateTime.now().minusDays(1))
            .build());

        listingRepository.save(Listing.builder()
            .user(host).title("Inactive Event")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .isActive(false)
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/" + host.getId() + "/listings", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Upcoming Event");
        assertThat(response.getBody()).doesNotContain("Expired Event");
        assertThat(response.getBody()).doesNotContain("Inactive Event");
        assertThat(response.getBody()).contains("Test Host");
    }

    @Test
    void getHostListings_returns404ForUnknownUser() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/99999/listings", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getListingById_includesSubmitterNameAndAvatarUrl() {
        User host = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-host2")
            .email("host2@test.com").name("Named Host")
            .role(UserRole.USER).build());

        Listing listing = listingRepository.save(Listing.builder()
            .user(host).title("Named Event")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().minusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(30))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/listings/" + listing.getId(), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("submittedByName");
        assertThat(response.getBody()).contains("Named Host");
        assertThat(response.getBody()).contains("submittedByAvatarUrl");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail (endpoint doesn't exist yet if running out of order, or verify pass)**

```bash
mvn test -Dtest=HostProfileTest -q
```
Expected: All 3 tests PASS (Tasks 1-3 are complete before this task).

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/com/christmaslightmap/HostProfileTest.java
git commit -m "test: add HostProfileTest integration tests"
```

---

### Task 5: Frontend model types + API service

**Files:**
- Modify: `frontend/src/app/models/listing.model.ts`
- Modify: `frontend/src/app/services/listing-api.service.ts`

- [ ] **Step 1: Add `submittedByName` and `submittedByAvatarUrl` to `Listing` interface**

In `listing.model.ts`, the `Listing` interface currently ends with `photos: Photo[]`. Add two fields after `submittedBy: number`:

```typescript
/** Returned by GET /listings/:id */
export interface Listing extends ListingSummary {
  submittedBy: number;
  submittedByName: string;
  submittedByAvatarUrl: string | null;
  description: string;
  address: string;
  postcode: string;
  bestTime: string | null;
  createdAt: string;
  photos: Photo[];
}
```

- [ ] **Step 2: Add `HostUser` and `HostListingsResponse` interfaces**

Add these after the `Report` interface in `listing.model.ts`:

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

- [ ] **Step 3: Add `getHostListings()` to `listing-api.service.ts`**

Add this import at the top of `listing-api.service.ts` alongside existing imports from `listing.model`:
```typescript
import {
  Listing, ListingSummary, Tag, Report, HostListingsResponse,
  PagedResponse, SearchParams, CreateListingRequest, UpdateListingRequest
} from '../models/listing.model';
```

Add this method after `getUpvotedListings()`:

```typescript
getHostListings(userId: number): Observable<HostListingsResponse> {
  return this.http.get<ApiResponse<HostListingsResponse>>(
    `${this.base}/users/${userId}/listings`, { withCredentials: true }
  ).pipe(map(r => r.data));
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx ng build --configuration production 2>&1 | grep -E "error|Error|complete"
```
Expected: `Application bundle generation complete.`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/models/listing.model.ts \
        frontend/src/app/services/listing-api.service.ts
git commit -m "feat: add HostUser/HostListingsResponse types and getHostListings() API method"
```

---

### Task 6: HostProfileComponent

**Files:**
- Create: `frontend/src/app/pages/host-profile/host-profile.component.ts`

- [ ] **Step 1: Create the component**

```typescript
import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HostUser, HostListingsResponse, ListingSummary, CATEGORY_COLORS, CATEGORY_LABELS, formatDateRange, getInitials } from '../../models/listing.model';
import { ListingApiService } from '../../services/listing-api.service';
import { DisplayCardComponent } from '../../shared/display-card/display-card.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';

@Component({
  selector: 'app-host-profile',
  standalone: true,
  imports: [CommonModule, DisplayCardComponent, AvatarComponent],
  template: `
    <div style="height:100%;overflow-y:auto;background:#f8fafc;padding-bottom:40px">
      <div style="max-width:600px;margin:0 auto;padding:0 20px">

        <!-- Header bar -->
        <div style="display:flex;align-items:center;padding:16px 0 8px;gap:12px">
          <button (click)="back.emit()"
                  style="width:36px;height:36px;border-radius:50%;background:white;border:1.5px solid #e2e8f0;
                         cursor:pointer;display:flex;align-items:center;justify-content:center;
                         box-shadow:0 1px 4px rgba(0,0,0,0.06);flex-shrink:0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.5">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <span style="font-weight:700;font-size:16px;color:#0f172a">Events</span>
        </div>

        <!-- Host profile card -->
        <div style="background:white;border-radius:16px;padding:24px;margin-bottom:20px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">
          <div style="display:flex;align-items:center;gap:16px">
            <!-- Avatar: photo if available, else initials -->
            <img *ngIf="host.avatarUrl"
                 [src]="host.avatarUrl"
                 [alt]="host.name"
                 style="width:60px;height:60px;border-radius:50%;object-fit:cover;flex-shrink:0"/>
            <app-avatar *ngIf="!host.avatarUrl"
                        [initials]="getInitials(host.name)" [size]="60"/>
            <div>
              <div style="font-weight:800;font-size:19px;color:#0f172a">{{host.name}}</div>
              <div style="font-size:13px;color:#64748b;margin-top:2px">
                {{listings().length}} upcoming event{{listings().length === 1 ? '' : 's'}}
              </div>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="loading()"
             style="text-align:center;padding:48px 0;color:#94a3b8;font-size:14px">
          Loading…
        </div>

        <!-- Error -->
        <div *ngIf="loadError()"
             style="padding:16px 20px;background:#fee2e2;border-radius:12px;margin-bottom:12px;
                    font-size:13.5px;color:#dc2626;font-weight:600">
          Could not load events. Try again.
          <button (click)="load()"
                  style="margin-left:12px;padding:4px 12px;border-radius:8px;font-size:12px;
                         font-weight:600;background:#dc2626;color:white;border:none;cursor:pointer">
            Retry
          </button>
        </div>

        <!-- Event list -->
        <ng-container *ngIf="!loading() && !loadError()">
          <div *ngIf="listings().length === 0"
               style="text-align:center;padding:48px 0;color:#94a3b8;font-size:14px">
            No upcoming events from this host
          </div>
          <app-display-card *ngFor="let d of listings()"
            [display]="d" [upvoted]="false" [showDetails]="false"
            (select)="viewDetails.emit(d)"
            (viewDetails)="viewDetails.emit(d)"/>
        </ng-container>

      </div>
    </div>
  `
})
export class HostProfileComponent implements OnInit {
  @Input() host!: HostUser;
  @Output() back = new EventEmitter<void>();
  @Output() viewDetails = new EventEmitter<ListingSummary>();

  loading = signal(true);
  loadError = signal(false);
  listings = signal<ListingSummary[]>([]);

  getInitials = getInitials;

  private listingApi = inject(ListingApiService);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.listingApi.getHostListings(this.host.id).subscribe({
      next: (data: HostListingsResponse) => {
        this.listings.set(data.listings);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npx ng build --configuration production 2>&1 | grep -E "error|Error|complete"
```
Expected: `Application bundle generation complete.`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/pages/host-profile/host-profile.component.ts
git commit -m "feat: add HostProfileComponent full-screen with avatar, name, upcoming event list"
```

---

### Task 7: DisplayDetailComponent — host byline + viewHost output

**Files:**
- Modify: `frontend/src/app/shared/display-detail/display-detail.component.ts`

- [ ] **Step 1: Add `HostUser` import and `viewHost` output**

Update the import line to include `HostUser`:
```typescript
import { Listing, ListingSummary, HostUser, CATEGORY_COLORS, CATEGORY_LABELS, formatDateRange } from '../../models/listing.model';
```

Add `viewHost` output after the existing `@Output() report` line:
```typescript
@Output() viewHost = new EventEmitter<HostUser>();
```

Add a helper method before `ngOnInit`:
```typescript
onViewHost() {
  const d = this.fullDisplay();
  if (!d) return;
  this.viewHost.emit({ id: d.submittedBy, name: d.submittedByName, avatarUrl: d.submittedByAvatarUrl });
}
```

- [ ] **Step 2: Add the host byline to the template**

In the template, locate the `<!-- Header -->` section which currently reads:
```html
<!-- Header -->
<div style="flex:1">
  <div style="font-weight:800;font-size:20px;color:#0f172a;line-height:1.2;margin-bottom:4px">
    {{fullDisplay()!.title}}
  </div>
  <div style="font-size:13px;color:#64748b">📍 {{fullDisplay()!.address}}</div>
</div>
```

Replace it with:
```html
<!-- Header -->
<div style="flex:1">
  <div style="font-weight:800;font-size:20px;color:#0f172a;line-height:1.2;margin-bottom:4px">
    {{fullDisplay()!.title}}
  </div>
  <div style="font-size:13px;color:#64748b;margin-bottom:4px">📍 {{fullDisplay()!.address}}</div>
  <div (click)="onViewHost()"
       style="font-size:13px;color:var(--accent);cursor:pointer;font-weight:600;
              display:inline-block">
    By {{fullDisplay()!.submittedByName}}
  </div>
</div>
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npx ng build --configuration production 2>&1 | grep -E "error|Error|complete"
```
Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/shared/display-detail/display-detail.component.ts
git commit -m "feat: add host byline to event detail modal with viewHost output"
```

---

### Task 8: AppComponent — wire host profile screen

**Files:**
- Modify: `frontend/src/app/app.component.ts`

- [ ] **Step 1: Add `HostProfileComponent` import and update `Screen` type**

Update the imports block at the top of `app.component.ts`:
```typescript
import { Component, OnInit, signal, computed, effect, HostListener } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ListingSummary, HostUser } from './models/listing.model';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { BottomTabBarComponent } from './shared/bottom-tab-bar/bottom-tab-bar.component';
import { SignInModalComponent } from './shared/sign-in-modal/sign-in-modal.component';
import { DisplayDetailComponent } from './shared/display-detail/display-detail.component';
import { MapComponent } from './pages/map/map.component';
import { SubmitComponent } from './pages/submit/submit.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { AdminComponent } from './pages/admin/admin.component';
import { HostProfileComponent } from './pages/host-profile/host-profile.component';
import { AuthService } from './services/auth.service';
import { UpvoteService } from './services/upvote.service';
```

Update the `Screen` type:
```typescript
type Screen = 'map' | 'submit' | 'profile' | 'admin' | 'host';
```

Add `HostProfileComponent` to the `imports` array in `@Component`:
```typescript
imports: [
  CommonModule, FormsModule,
  NavbarComponent, BottomTabBarComponent,
  SignInModalComponent, DisplayDetailComponent,
  MapComponent, SubmitComponent, ProfileComponent, AdminComponent, HostProfileComponent,
],
```

- [ ] **Step 2: Add `viewingHost` signal**

In the class body, after `editSource = signal<'profile' | 'admin'>('profile')`:
```typescript
viewingHost = signal<HostUser | null>(null);
```

- [ ] **Step 3: Add `openHostProfile()` method**

After the `onAdminEditListing()` method:
```typescript
openHostProfile(host: HostUser) {
  this.selectedDisplay.set(null);
  this.viewingHost.set(host);
  this.screen.set('host');
  this.location.replaceState('/host');
}
```

- [ ] **Step 4: Update `navigate()` to clear `viewingHost` when leaving host screen**

In the existing `navigate()` method, add one line after `if (screen !== 'submit') this.editingListing.set(null);`:
```typescript
if (screen !== 'host') this.viewingHost.set(null);
```

- [ ] **Step 5: Add host profile screen and wire `viewHost` output in the template**

Add `app-host-profile` to the main content area after `app-admin`:
```html
<app-host-profile *ngIf="screen() === 'host'"
  [host]="viewingHost()!"
  style="display:block;height:100%"
  (back)="navigate('map')"
  (viewDetails)="openDetail($event)"/>
```

Update the `app-display-detail` element to wire the `viewHost` output:
```html
<app-display-detail *ngIf="selectedDisplay()"
  [summary]="selectedDisplay()!"
  [upvoted]="isUpvoted(selectedDisplay()!.id)"
  [isMobile]="isMobile"
  (close)="selectedDisplay.set(null)"
  (upvote)="upvoteService.toggle(selectedDisplay()!.id)"
  (report)="selectedDisplay.set(null)"
  (viewHost)="openHostProfile($event)"/>
```

- [ ] **Step 6: Verify build**

```bash
cd frontend && npx ng build --configuration production 2>&1 | grep -E "error|Error|complete"
```
Expected: `Application bundle generation complete.`

- [ ] **Step 7: Run backend tests**

```bash
cd backend && mvn test -q 2>&1 | tail -5
```
Expected: `BUILD SUCCESS`

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/app.component.ts
git commit -m "feat: wire HostProfileComponent into AppComponent; add viewingHost signal and openHostProfile()"
```
