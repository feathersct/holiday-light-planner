# User & Host Service Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize user and host responsibilities across frontend services and backend controllers/services so each unit has a single, clear purpose.

**Architecture:** Move host-listing logic from `UserService`/`UserController` to `HostService`/`HostController` with updated `/hosts/...` endpoint URLs. Update `SecurityConfig` to expose the new public endpoints. On the frontend, extract host, user-profile, and admin operations from `ListingApiService` into three new focused services (`HostService`, `UserService`, `AdminService`). The "Profile URL handle" section is removed from `ProfileComponent` because the user handle update endpoint is being removed — handles are managed per-host only.

**Tech Stack:** Spring Boot 3.5, Angular 17 standalone components with signals, PostgreSQL + PostGIS, Testcontainers (backend integration tests)

---

## File Map

**Backend — Modified:**
- `backend/src/main/java/com/christmaslightmap/service/HostService.java` — gains `getHostListings`, `getHostListingsByHandle`, private `getHostListingsForHostEntity`
- `backend/src/main/java/com/christmaslightmap/service/UserService.java` — trimmed to `updateDisplayName` + `generateUniqueHandle` only
- `backend/src/main/java/com/christmaslightmap/controller/HostController.java` — add `GET /{userId}/listings` and `GET /handle/{handle}`
- `backend/src/main/java/com/christmaslightmap/controller/UserController.java` — trimmed to `PATCH /me` only
- `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java` — update permitAll rules
- `backend/src/test/java/com/christmaslightmap/HostHandleTest.java` — update handle-lookup URL, remove updateHandle tests
- `backend/src/test/java/com/christmaslightmap/HostProfileTest.java` — update two endpoint URLs

**Backend — Created:**
- `backend/src/test/java/com/christmaslightmap/HostListingsTest.java`

**Frontend — Created:**
- `frontend/src/app/services/host.service.ts`
- `frontend/src/app/services/user.service.ts`
- `frontend/src/app/services/admin.service.ts`

**Frontend — Modified:**
- `frontend/src/app/services/listing-api.service.ts` — remove all non-listing methods
- `frontend/src/app/pages/profile/profile.component.ts` — inject new services, remove handle section
- `frontend/src/app/pages/host-profile/host-profile.component.ts` — use `HostService`
- `frontend/src/app/pages/admin/admin.component.ts` — use `AdminService`

---

### Task 1: Write failing integration tests for the new host endpoints

**Files:**
- Create: `backend/src/test/java/com/christmaslightmap/HostListingsTest.java`

- [ ] **Step 1: Create the test file**

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

class HostListingsTest extends BaseIntegrationTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private ListingRepository listingRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private HostRepository hostRepository;

    @AfterEach
    void cleanUp() {
        listingRepository.deleteAll();
        hostRepository.deleteAll();
        userRepository.deleteAll();
    }

    private Point point(double lng, double lat) {
        Point p = GF.createPoint(new Coordinate(lng, lat));
        p.setSRID(4326);
        return p;
    }

    @Test
    void getHostByHandle_returnsListingsAtNewPath() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-hl1")
            .email("hl1@test.com").name("Host Listing User")
            .role(UserRole.USER).handle("hl-user-1").build());

        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("hl-host-1").displayName("Host Listing").build());

        listingRepository.save(Listing.builder()
            .host(host).title("Active Listing")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/hosts/handle/hl-host-1", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Active Listing");
        assertThat(response.getBody()).contains("Host Listing");
    }

    @Test
    void getHostListingsByUserId_returns404ForUnknownUser() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/hosts/99999/listings", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getHostByHandle_returns404ForUnknownHandle() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/hosts/handle/nonexistent-handle", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getHostByHandle_isPublicNoAuthRequired() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-hl2")
            .email("hl2@test.com").name("Public Host")
            .role(UserRole.USER).handle("hl-user-2").build());

        hostRepository.save(Host.builder()
            .owner(owner).handle("hl-public-host").displayName("Public Host").build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/hosts/handle/hl-public-host", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
```

- [ ] **Step 2: Run the tests to confirm they fail (endpoints don't exist yet)**

```bash
cd backend
mvn test -Dtest=HostListingsTest -q 2>&1 | tail -20
```
Expected: FAIL — `404` responses (endpoints not registered)

---

### Task 2: Add host-listing methods to HostService

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/service/HostService.java`

- [ ] **Step 1: Add new imports**

After the existing `import java.util.List;` line, add:

```java
import com.christmaslightmap.dto.response.HostListingsResponse;
import com.christmaslightmap.dto.response.HostUserResponse;
import com.christmaslightmap.dto.response.ListingSummaryResponse;
import com.christmaslightmap.dto.response.TagResponse;
import com.christmaslightmap.model.DisplayPhoto;
import com.christmaslightmap.model.Listing;
import com.christmaslightmap.repository.DisplayPhotoRepository;
import java.time.LocalDateTime;
import java.util.Map;
```

- [ ] **Step 2: Add DisplayPhotoRepository field**

After `private final ListingRepository listingRepository;`, add:

```java
private final DisplayPhotoRepository displayPhotoRepository;
```

- [ ] **Step 3: Add the three new methods before the existing private findOwned() method**

```java
public HostListingsResponse getHostListings(Long userId) {
    User user = userRepository.findById(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    return HostListingsResponse.builder()
        .user(HostUserResponse.from(user))
        .listings(List.of())
        .build();
}

public HostListingsResponse getHostListingsByHandle(String handle) {
    return hostRepository.findByHandle(handle)
        .map(this::getHostListingsForHostEntity)
        .orElseGet(() -> {
            User user = userRepository.findByHandle(handle)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Host not found"));
            return getHostListings(user.getId());
        });
}

private HostListingsResponse getHostListingsForHostEntity(Host host) {
    List<Listing> listings = listingRepository.findActiveByHostId(host.getId(), LocalDateTime.now());

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
            .resolvedHostName(host.getDisplayName())
            .build())
        .collect(Collectors.toList());

    return HostListingsResponse.builder()
        .user(HostUserResponse.from(host))
        .listings(summaries)
        .build();
}
```

---

### Task 3: Add new endpoints to HostController

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/controller/HostController.java`

- [ ] **Step 1: Add HostListingsResponse import**

After `import com.christmaslightmap.dto.response.HostResponse;`, add:

```java
import com.christmaslightmap.dto.response.HostListingsResponse;
```

- [ ] **Step 2: Add two new public endpoint methods after getMyHosts()**

```java
@GetMapping("/{userId}/listings")
public ResponseEntity<ApiResponse<HostListingsResponse>> getHostListings(@PathVariable Long userId) {
    return ResponseEntity.ok(ApiResponse.success(hostService.getHostListings(userId)));
}

@GetMapping("/handle/{handle}")
public ResponseEntity<ApiResponse<HostListingsResponse>> getHostByHandle(@PathVariable String handle) {
    return ResponseEntity.ok(ApiResponse.success(hostService.getHostListingsByHandle(handle)));
}
```

---

### Task 4: Update SecurityConfig permitAll rules

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java`

- [ ] **Step 1: Replace the three old user endpoint permit rules with two new host rules**

Replace:
```java
.requestMatchers(HttpMethod.GET, "/api/v1/users/search").permitAll()
.requestMatchers(HttpMethod.GET, "/api/v1/users/*/listings").permitAll()
.requestMatchers(HttpMethod.GET, "/api/v1/users/handle/**").permitAll()
```

With:
```java
.requestMatchers(HttpMethod.GET, "/api/v1/hosts/*/listings").permitAll()
.requestMatchers(HttpMethod.GET, "/api/v1/hosts/handle/**").permitAll()
```

---

### Task 5: Run new tests to confirm they pass

- [ ] **Step 1: Run HostListingsTest**

```bash
cd backend
mvn test -Dtest=HostListingsTest -q 2>&1 | tail -20
```
Expected: All 4 tests PASS

---

### Task 6: Update HostHandleTest — move URL paths, remove updateHandle tests

**Files:**
- Modify: `backend/src/test/java/com/christmaslightmap/HostHandleTest.java`

The `updateHandle_*` tests cover `PATCH /api/v1/users/me/handle` which is being removed. The `getHostByHandle_*` tests cover an endpoint moving to `/api/v1/hosts/handle/{handle}`.

- [ ] **Step 1: Delete the four updateHandle tests and their helper**

Remove these methods entirely:
- `authHeaders(User user)` helper (lines 41–46)
- `updateHandle_succeeds()` (lines 85–105)
- `updateHandle_returns409WhenHandleTaken()` (lines 107–130)
- `updateHandle_returns400ForInvalidFormat()` (lines 132–149)
- `updateHandle_returns401WhenUnauthenticated()` (lines 167–178)

Also remove these now-unused fields and imports:
- `@Autowired private JwtService jwtService;`
- `import com.christmaslightmap.security.JwtService;`
- `import java.util.Map;`
- `import org.springframework.http.HttpHeaders;`
- `import org.springframework.http.HttpMethod;`
- `import org.springframework.http.MediaType;`

- [ ] **Step 2: Update the three getHostByHandle tests to use the new path**

Change every occurrence of `/api/v1/users/handle/` to `/api/v1/hosts/handle/`. There are three:

```java
// getHostByHandle_returnsHostAndListings
ResponseEntity<String> response = restTemplate.getForEntity(
    "/api/v1/hosts/handle/handle-host", String.class);

// getHostByHandle_returns404ForUnknownHandle
ResponseEntity<String> response = restTemplate.getForEntity(
    "/api/v1/hosts/handle/nonexistent-handle", String.class);

// getHostByHandle_isPublicNoAuthRequired
ResponseEntity<String> response = restTemplate.getForEntity(
    "/api/v1/hosts/handle/public-host", String.class);
```

---

### Task 7: Update HostProfileTest — update two endpoint URLs

**Files:**
- Modify: `backend/src/test/java/com/christmaslightmap/HostProfileTest.java`

- [ ] **Step 1: Update the handle lookup URL (line 77)**

Change:
```java
"/api/v1/users/handle/test-host-profile"
```
To:
```java
"/api/v1/hosts/handle/test-host-profile"
```

- [ ] **Step 2: Update the userId listings URL (line 89)**

Change:
```java
"/api/v1/users/99999/listings"
```
To:
```java
"/api/v1/hosts/99999/listings"
```

---

### Task 8: Run all backend tests

- [ ] **Step 1: Run the full backend test suite**

```bash
cd backend
mvn test -q 2>&1 | tail -30
```
Expected: All tests PASS. If any fail, check the error — it likely references an old `/users/...` endpoint in a test file not covered above. Update that URL to the new `/hosts/...` path and re-run.

---

### Task 9: Trim UserController and UserService

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/controller/UserController.java`
- Modify: `backend/src/main/java/com/christmaslightmap/service/UserService.java`

- [ ] **Step 1: Replace UserController.java with the trimmed version**

```java
package com.christmaslightmap.controller;

import com.christmaslightmap.dto.request.UpdateDisplayNameRequest;
import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.HostUserResponse;
import com.christmaslightmap.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PatchMapping("/me")
    public ResponseEntity<ApiResponse<HostUserResponse>> updateDisplayName(
        @RequestBody UpdateDisplayNameRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(userService.updateDisplayName(userId, request)));
    }
}
```

- [ ] **Step 2: Replace UserService.java with the trimmed version**

```java
package com.christmaslightmap.service;

import com.christmaslightmap.dto.request.UpdateDisplayNameRequest;
import com.christmaslightmap.dto.response.HostUserResponse;
import com.christmaslightmap.model.User;
import com.christmaslightmap.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;

    @Transactional
    public HostUserResponse updateDisplayName(Long userId, UpdateDisplayNameRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        String name = request.getDisplayName();
        user.setDisplayName((name == null || name.isBlank()) ? null : name.trim().substring(0, Math.min(name.trim().length(), 100)));
        return HostUserResponse.from(userRepository.save(user));
    }

    public String generateUniqueHandle(String displayName, String fallbackName) {
        String source = (displayName != null && !displayName.isBlank()) ? displayName : fallbackName;
        if (source == null || source.isBlank()) source = "user";
        String slug = source.toLowerCase()
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-+|-+$", "");
        if (slug.length() < 3) slug = "user-" + slug;
        if (slug.length() > 20) slug = slug.substring(0, 20).replaceAll("-+$", "");
        if (!userRepository.existsByHandle(slug)) return slug;
        for (int i = 2; i <= 99; i++) {
            String candidate = slug + "-" + i;
            if (!userRepository.existsByHandle(candidate)) return candidate;
        }
        return slug + "-" + (System.currentTimeMillis() % 10000);
    }
}
```

---

### Task 10: Run all backend tests and commit

- [ ] **Step 1: Run the full backend test suite**

```bash
cd backend
mvn test -q 2>&1 | tail -30
```
Expected: All tests PASS

- [ ] **Step 2: Commit all backend changes**

```bash
git add backend/src/
git commit -m "refactor: move host-listing endpoints from UserController to HostController"
```

---

### Task 11: Create frontend HostService

**Files:**
- Create: `frontend/src/app/services/host.service.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HostEntity, HostListingsResponse, HostSearchResult } from '../models/listing.model';
import { environment } from '../../environments/environment';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class HostService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1`;

  searchHosts(q: string): Observable<HostSearchResult[]> {
    return this.http.get<ApiResponse<HostEntity[]>>(
      `${this.base}/hosts`, { params: { q }, withCredentials: true }
    ).pipe(
      map(r => r.data.map(h => ({ id: h.id, name: h.displayName, displayName: h.displayName, avatarUrl: h.avatarUrl, handle: h.handle } as HostSearchResult))),
      catchError(() => of([] as HostSearchResult[]))
    );
  }

  getHostListings(userId: number): Observable<HostListingsResponse> {
    return this.http.get<ApiResponse<HostListingsResponse>>(
      `${this.base}/hosts/${userId}/listings`, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  getHostListingsByHandle(handle: string): Observable<HostListingsResponse> {
    return this.http.get<ApiResponse<HostListingsResponse>>(
      `${this.base}/hosts/handle/${handle}`, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  createHost(displayName: string, handle: string): Observable<HostEntity> {
    return this.http.post<ApiResponse<HostEntity>>(
      `${this.base}/hosts`, { displayName, handle }, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  updateHost(id: number, displayName?: string, handle?: string): Observable<HostEntity> {
    const body: Record<string, string> = {};
    if (displayName !== undefined) body['displayName'] = displayName;
    if (handle !== undefined) body['handle'] = handle;
    return this.http.patch<ApiResponse<HostEntity>>(
      `${this.base}/hosts/${id}`, body, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  uploadHostAvatar(id: number, file: File): Observable<HostEntity> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<HostEntity>>(
      `${this.base}/hosts/${id}/avatar`, fd, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  deleteHost(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/hosts/${id}`, { withCredentials: true }
    );
  }

  transferHost(id: number, targetHandle: string): Observable<void> {
    return this.http.post<void>(
      `${this.base}/hosts/${id}/transfer`, { targetHandle }, { withCredentials: true }
    );
  }
}
```

---

### Task 12: Create frontend UserService

**Files:**
- Create: `frontend/src/app/services/user.service.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HostEntity, HostSearchResult } from '../models/listing.model';
import { environment } from '../../environments/environment';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1`;

  getMyHosts(): Observable<HostEntity[]> {
    return this.http.get<ApiResponse<HostEntity[]>>(
      `${this.base}/hosts/me`, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  updateDisplayName(displayName: string): Observable<HostSearchResult> {
    return this.http.patch<ApiResponse<HostSearchResult>>(
      `${this.base}/users/me`, { displayName }, { withCredentials: true }
    ).pipe(map(r => r.data));
  }
}
```

---

### Task 13: Create frontend AdminService

**Files:**
- Create: `frontend/src/app/services/admin.service.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Report, Listing, ListingSummary, PagedResponse, UpdateListingRequest } from '../models/listing.model';
import { environment } from '../../environments/environment';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1`;

  getReports(status?: string, page = 0, size = 20): Observable<PagedResponse<Report>> {
    let p = new HttpParams().set('page', page).set('size', size);
    if (status && status !== 'ALL') p = p.set('status', status);
    return this.http.get<ApiResponse<PagedResponse<Report>>>(
      `${this.base}/admin/reports`, { params: p, withCredentials: true }
    ).pipe(map(r => r.data));
  }

  updateReport(reportId: number, status: string): Observable<Report> {
    return this.http.patch<ApiResponse<Report>>(
      `${this.base}/admin/reports/${reportId}`, { status }, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  adminGetListings(active?: boolean, page = 0, size = 50): Observable<PagedResponse<ListingSummary>> {
    let p = new HttpParams().set('page', page).set('size', size);
    if (active !== undefined) p = p.set('active', active);
    return this.http.get<ApiResponse<PagedResponse<ListingSummary>>>(
      `${this.base}/admin/listings`, { params: p, withCredentials: true }
    ).pipe(map(r => r.data));
  }

  adminSetListingActive(listingId: number, active: boolean): Observable<ListingSummary> {
    return this.http.patch<ApiResponse<ListingSummary>>(
      `${this.base}/admin/listings/${listingId}/status`, { active }, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  adminUpdateListing(id: number, request: UpdateListingRequest): Observable<Listing> {
    return this.http.patch<ApiResponse<Listing>>(
      `${this.base}/admin/listings/${id}`, request, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  adminDeleteListing(listingId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/admin/listings/${listingId}`, { withCredentials: true }
    );
  }
}
```

---

### Task 14: Trim ListingApiService

**Files:**
- Modify: `frontend/src/app/services/listing-api.service.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Listing, ListingSummary, Tag,
  PagedResponse, SearchParams, CreateListingRequest, UpdateListingRequest
} from '../models/listing.model';
import { environment } from '../../environments/environment';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class ListingApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1`;

  search(params: SearchParams): Observable<PagedResponse<ListingSummary>> {
    let p = new HttpParams()
      .set('lat', params.lat)
      .set('lng', params.lng)
      .set('radiusMiles', params.radiusMiles ?? 10)
      .set('page', params.page ?? 0)
      .set('size', params.size ?? 50);
    if (params.category) p = p.set('category', params.category);
    if (params.tags?.length) p = p.set('tags', params.tags.join(','));
    return this.http.get<ApiResponse<PagedResponse<ListingSummary>>>(`${this.base}/listings/search`, { params: p, withCredentials: true })
      .pipe(map(r => r.data));
  }

  getById(id: number): Observable<Listing> {
    return this.http.get<ApiResponse<Listing>>(`${this.base}/listings/${id}`, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  create(request: CreateListingRequest): Observable<Listing> {
    return this.http.post<ApiResponse<Listing>>(`${this.base}/listings`, request, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  update(id: number, request: UpdateListingRequest): Observable<Listing> {
    return this.http.patch<ApiResponse<Listing>>(`${this.base}/listings/${id}`, request, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  deletePhoto(listingId: number, photoId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/listings/${listingId}/photos/${photoId}`, { withCredentials: true });
  }

  uploadPhoto(listingId: number, file: File): Observable<{ id: number; url: string; isPrimary: boolean }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<{ id: number; url: string; isPrimary: boolean }>>(`${this.base}/listings/${listingId}/photos`, fd, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  upvote(listingId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/listings/${listingId}/upvote`, {}, { withCredentials: true });
  }

  removeUpvote(listingId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/listings/${listingId}/upvote`, { withCredentials: true });
  }

  report(listingId: number, reason: string, notes: string): Observable<void> {
    return this.http.post<void>(`${this.base}/listings/${listingId}/report`, { reason, notes }, { withCredentials: true });
  }

  getTags(): Observable<Tag[]> {
    return this.http.get<ApiResponse<Tag[]>>(`${this.base}/tags`, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  getUpvotedListings(): Observable<ListingSummary[]> {
    return this.http.get<ApiResponse<ListingSummary[]>>(`${this.base}/listings/upvoted`, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  deleteListing(listingId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/listings/${listingId}`, { withCredentials: true });
  }
}
```

---

### Task 15: Update ProfileComponent

**Files:**
- Modify: `frontend/src/app/pages/profile/profile.component.ts`

The "Profile URL handle" section is removed from the template and the corresponding signals and method are deleted. Host CRUD moves to `HostService`; `getMyHosts` and `updateDisplayName` move to `UserService`.

- [ ] **Step 1: Add HostService and UserService imports**

After `import { ListingApiService } from '../../services/listing-api.service';`, add:

```typescript
import { HostService } from '../../services/host.service';
import { UserService } from '../../services/user.service';
```

- [ ] **Step 2: Add new service injections**

After `private listingApi = inject(ListingApiService);`, add:

```typescript
private hostService = inject(HostService);
private userService = inject(UserService);
```

- [ ] **Step 3: Replace ngOnInit with the updated version**

```typescript
ngOnInit() {
  this.listingApi.getUpvotedListings().subscribe({
    next: d => { this.upvotedListings.set(d); this.loadingUpvoted.set(false); },
    error: () => this.loadingUpvoted.set(false),
  });
  if (this.user?.displayName) {
    this.displayName.set(this.user.displayName);
  }
  if (this.user) {
    this.userService.getMyHosts().subscribe({
      next: h => { this.hosts.set(h); this.hostsLoading.set(false); },
      error: () => this.hostsLoading.set(false),
    });
  } else {
    this.hostsLoading.set(false);
  }
}
```

- [ ] **Step 4: Remove the five handle-related signal declarations**

Delete these five lines:
```typescript
handle = signal('');
savingHandle = signal(false);
handleSaved = signal(false);
handleError = signal('');
handleLoading = signal(true);
```

- [ ] **Step 5: Update saveDisplayName to use UserService**

Replace:
```typescript
this.listingApi.updateDisplayName(this.displayName()).subscribe({
```
With:
```typescript
this.userService.updateDisplayName(this.displayName()).subscribe({
```

- [ ] **Step 6: Delete the saveHandle() method entirely**

Remove the complete `saveHandle()` method (the block starting `saveHandle() {` through its closing `}`).

- [ ] **Step 7: Update createHost to use HostService**

Replace:
```typescript
this.listingApi.createHost(name, handle).subscribe({
```
With:
```typescript
this.hostService.createHost(name, handle).subscribe({
```

- [ ] **Step 8: Update saveHost to use HostService**

Replace:
```typescript
this.listingApi.updateHost(hostId, name, handle).subscribe({
```
With:
```typescript
this.hostService.updateHost(hostId, name, handle).subscribe({
```

- [ ] **Step 9: Update onHostAvatarChange to use HostService**

Replace:
```typescript
this.listingApi.uploadHostAvatar(hostId, file).subscribe({
```
With:
```typescript
this.hostService.uploadHostAvatar(hostId, file).subscribe({
```

- [ ] **Step 10: Update doTransferHost to use HostService**

Replace:
```typescript
this.listingApi.transferHost(hostId, handle).subscribe({
```
With:
```typescript
this.hostService.transferHost(hostId, handle).subscribe({
```

- [ ] **Step 11: Update doDeleteHost to use HostService**

Replace:
```typescript
this.listingApi.deleteHost(hostId).subscribe({
```
With:
```typescript
this.hostService.deleteHost(hostId).subscribe({
```

- [ ] **Step 12: Remove the "Profile URL handle" section from the template**

Delete the entire handle section from the template — the `<div>` block that starts with `<!-- Handle / profile URL -->` and ends before `<!-- Your Hosts -->`. It is the block containing the `saveHandle()` button and `{{handleError()}}` display.

---

### Task 16: Update HostProfileComponent

**Files:**
- Modify: `frontend/src/app/pages/host-profile/host-profile.component.ts`

- [ ] **Step 1: Replace ListingApiService import with HostService**

Replace:
```typescript
import { ListingApiService } from '../../services/listing-api.service';
```
With:
```typescript
import { HostService } from '../../services/host.service';
```

- [ ] **Step 2: Replace the injected service field**

Replace:
```typescript
private listingApi = inject(ListingApiService);
```
With:
```typescript
private hostService = inject(HostService);
```

- [ ] **Step 3: Update the load() method**

Replace:
```typescript
const request$ = this.host.handle
  ? this.listingApi.getHostListingsByHandle(this.host.handle)
  : this.listingApi.getHostListings(this.host.id);
```
With:
```typescript
const request$ = this.host.handle
  ? this.hostService.getHostListingsByHandle(this.host.handle)
  : this.hostService.getHostListings(this.host.id);
```

---

### Task 17: Update AdminComponent

**Files:**
- Modify: `frontend/src/app/pages/admin/admin.component.ts`

- [ ] **Step 1: Add AdminService import**

After `import { ListingApiService } from '../../services/listing-api.service';`, add:
```typescript
import { AdminService } from '../../services/admin.service';
```

- [ ] **Step 2: Add AdminService injection**

After `private listingApi = inject(ListingApiService);`, add:
```typescript
private adminService = inject(AdminService);
```

- [ ] **Step 3: Update getReports call**

Replace:
```typescript
this.listingApi.getReports(this.statusFilter()).subscribe({
```
With:
```typescript
this.adminService.getReports(this.statusFilter()).subscribe({
```

- [ ] **Step 4: Update adminGetListings call**

Replace:
```typescript
this.listingApi.adminGetListings().subscribe({
```
With:
```typescript
this.adminService.adminGetListings().subscribe({
```

- [ ] **Step 5: Update both updateReport calls**

Replace:
```typescript
this.listingApi.updateReport(r.id, 'RESOLVED').subscribe({
```
With:
```typescript
this.adminService.updateReport(r.id, 'RESOLVED').subscribe({
```

Replace:
```typescript
this.listingApi.updateReport(r.id, 'DISMISSED').subscribe({
```
With:
```typescript
this.adminService.updateReport(r.id, 'DISMISSED').subscribe({
```

- [ ] **Step 6: Update adminSetListingActive call**

Replace:
```typescript
this.listingApi.adminSetListingActive(d.id, !d.isActive).subscribe({
```
With:
```typescript
this.adminService.adminSetListingActive(d.id, !d.isActive).subscribe({
```

- [ ] **Step 7: Update adminDeleteListing call**

Replace:
```typescript
this.listingApi.adminDeleteListing(id).subscribe({
```
With:
```typescript
this.adminService.adminDeleteListing(id).subscribe({
```

- [ ] **Step 8: Remove ListingApiService import and injection**

Delete:
```typescript
import { ListingApiService } from '../../services/listing-api.service';
```

Delete:
```typescript
private listingApi = inject(ListingApiService);
```

---

### Task 18: Verify frontend compiles and commit

- [ ] **Step 1: Build frontend**

```bash
cd frontend
npm run build 2>&1 | tail -30
```
Expected: Build succeeds with no TypeScript errors. If errors appear, they will reference a removed method or missing import — fix the specific line the error points to.

- [ ] **Step 2: Commit all frontend changes**

```bash
cd ..
git add frontend/src/
git commit -m "refactor: split ListingApiService into HostService, UserService, and AdminService"
```
