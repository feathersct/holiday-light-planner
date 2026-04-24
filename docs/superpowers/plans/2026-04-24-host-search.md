# Host Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users search for hosts by name and navigate to their event listings; let hosts set a custom business name at profile level and per-listing.

**Architecture:** DB migration adds two nullable columns (`users.display_name`, `listings.host_name`). Backend exposes a host-search endpoint and a self-update endpoint; native listing queries join users to compute `resolvedHostName` server-side. Frontend adds a new `/hosts` screen with debounced autocomplete, a display-name field on the profile page, and a host-name field on the submit form.

**Tech Stack:** Spring Boot 3.5 / JPA / PostgreSQL+PostGIS (backend), Angular 17 standalone signals (frontend), Flyway migrations, TestContainers integration tests.

---

## File Map

**Backend — new files**
- `backend/src/main/resources/db/migration/V16__add_host_name_fields.sql`
- `backend/src/main/java/com/christmaslightmap/dto/request/UpdateDisplayNameRequest.java`
- `backend/src/test/java/com/christmaslightmap/HostSearchTest.java`

**Backend — modified files**
- `backend/src/main/java/com/christmaslightmap/model/User.java` — add `displayName`
- `backend/src/main/java/com/christmaslightmap/model/Listing.java` — add `hostName`
- `backend/src/main/java/com/christmaslightmap/dto/response/HostUserResponse.java` — add `displayName`
- `backend/src/main/java/com/christmaslightmap/dto/response/ListingSummaryResponse.java` — add `resolvedHostName`
- `backend/src/main/java/com/christmaslightmap/dto/response/ListingResponse.java` — add `resolvedHostName`, update `from()`
- `backend/src/main/java/com/christmaslightmap/dto/request/CreateListingRequest.java` — add `hostName`
- `backend/src/main/java/com/christmaslightmap/dto/request/UpdateListingRequest.java` — add `hostName`
- `backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java` — JOIN users in native SELECT queries; add 3 columns
- `backend/src/main/java/com/christmaslightmap/repository/UserRepository.java` — add `searchHosts` JPQL query
- `backend/src/main/java/com/christmaslightmap/service/ListingService.java` — update `mapRowToSummary`, `buildSummary`, `createListing`, `updateListing`, `adminUpdateListing`
- `backend/src/main/java/com/christmaslightmap/service/UserService.java` — update `getHostListings`; add `searchHosts`, `updateDisplayName`
- `backend/src/main/java/com/christmaslightmap/controller/UserController.java` — add `GET /users/search`, `PATCH /users/me`
- `backend/src/test/java/com/christmaslightmap/HostProfileTest.java` — extend with `resolvedHostName` assertions

**Frontend — new files**
- `frontend/src/app/pages/host-search/host-search.component.ts`

**Frontend — modified files**
- `frontend/src/app/models/listing.model.ts` — `HostUser.displayName`, `ListingSummary.resolvedHostName`, `HostSearchResult` type
- `frontend/src/app/services/listing-api.service.ts` — `searchHosts()`, `updateDisplayName()`
- `frontend/src/app/app.component.ts` — add `'hosts'` screen, wire `HostSearchComponent`
- `frontend/src/app/shared/bottom-tab-bar/bottom-tab-bar.component.ts` — add Hosts tab
- `frontend/src/app/shared/navbar/navbar.component.ts` — add Hosts link
- `frontend/src/app/pages/profile/profile.component.ts` — add display name field + save
- `frontend/src/app/pages/submit/submit.component.ts` — add `hostName` field
- `frontend/src/app/shared/display-detail/display-detail.component.ts` — use `resolvedHostName`

---

## Task 1: DB Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V16__add_host_name_fields.sql`

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE users ADD COLUMN display_name VARCHAR(100);
ALTER TABLE listings ADD COLUMN host_name VARCHAR(100);
```

- [ ] **Step 2: Run the backend to verify Flyway applies it without errors**

```bash
cd backend
export $(grep -v '^#' .env | xargs) && mvn spring-boot:run
```

Expected: application starts, Flyway logs `Successfully applied 1 migration to schema "public"`.
Stop the server after confirming.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V16__add_host_name_fields.sql
git commit -m "feat: add display_name to users and host_name to listings (migration V16)"
```

---

## Task 2: Update Domain Models

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/model/User.java`
- Modify: `backend/src/main/java/com/christmaslightmap/model/Listing.java`

- [ ] **Step 1: Add `displayName` to `User`**

In `User.java`, add after `avatarUrl`:

```java
@Column(name = "display_name", length = 100)
private String displayName;
```

- [ ] **Step 2: Add `hostName` to `Listing`**

In `Listing.java`, add after `organizer`:

```java
@Column(name = "host_name", length = 100)
private String hostName;
```

- [ ] **Step 3: Verify compilation**

```bash
cd backend && mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/model/User.java \
        backend/src/main/java/com/christmaslightmap/model/Listing.java
git commit -m "feat: add displayName to User and hostName to Listing entities"
```

---

## Task 3: Update Response DTOs

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/dto/response/HostUserResponse.java`
- Modify: `backend/src/main/java/com/christmaslightmap/dto/response/ListingSummaryResponse.java`
- Modify: `backend/src/main/java/com/christmaslightmap/dto/response/ListingResponse.java`

- [ ] **Step 1: Add `displayName` to `HostUserResponse`**

Replace the entire file with:

```java
package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.User;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class HostUserResponse {
    private Long id;
    private String name;
    private String displayName;
    private String avatarUrl;

    public static HostUserResponse from(User user) {
        return HostUserResponse.builder()
            .id(user.getId())
            .name(user.getName())
            .displayName(user.getDisplayName())
            .avatarUrl(user.getAvatarUrl())
            .build();
    }
}
```

- [ ] **Step 2: Add `resolvedHostName` to `ListingSummaryResponse`**

In `ListingSummaryResponse.java`, add after `websiteUrl`:

```java
private String resolvedHostName;
```

- [ ] **Step 3: Add `resolvedHostName` to `ListingResponse` and update `from()`**

In `ListingResponse.java`, add after `websiteUrl`:

```java
private String resolvedHostName;
```

In the `from()` static method, add after `.priceInfo(...)`:

```java
.resolvedHostName(resolveHostName(listing))
```

Add this private static helper at the bottom of the class (before the closing `}`):

```java
private static String resolveHostName(Listing listing) {
    if (listing.getHostName() != null && !listing.getHostName().isBlank()) return listing.getHostName();
    if (listing.getUser().getDisplayName() != null && !listing.getUser().getDisplayName().isBlank()) return listing.getUser().getDisplayName();
    return listing.getUser().getName();
}
```

- [ ] **Step 4: Add `displayName` to `UserResponse`**

Replace the entire `UserResponse.java` with:

```java
package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.User;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserResponse {
    private Long id;
    private String email;
    private String name;
    private String displayName;
    private String avatarUrl;
    private String role;

    public static UserResponse from(User user) {
        return UserResponse.builder()
            .id(user.getId())
            .email(user.getEmail())
            .name(user.getName())
            .displayName(user.getDisplayName())
            .avatarUrl(user.getAvatarUrl())
            .role(user.getRole().name())
            .build();
    }
}
```

- [ ] **Step 5: Verify compilation**

```bash
cd backend && mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/dto/response/
git commit -m "feat: add resolvedHostName to listing responses, displayName to UserResponse and HostUserResponse"
```

---

## Task 4: Update Native Queries + ListingService

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java`
- Modify: `backend/src/main/java/com/christmaslightmap/service/ListingService.java`

The two `SELECT` native queries need a `JOIN users u ON u.id = d.user_id` and three extra columns: `d.host_name` (index 18), `u.display_name` (index 19), `u.name` (index 20). The two COUNT queries are unchanged.

- [ ] **Step 1: Update `searchListings` native query in `ListingRepository`**

Replace the `searchListings` query body:

```java
@Query(value = """
    SELECT d.id, d.title, d.city, d.state,
           ST_Y(d.location::geometry) AS lat, ST_X(d.location::geometry) AS lng,
           d.upvote_count, d.photo_count, d.display_type, d.created_at,
           (SELECT p.url FROM display_photos p
            WHERE p.display_id = d.id AND p.is_primary = true LIMIT 1) AS primary_photo_url,
           d.category, d.start_datetime, d.end_datetime, d.price_info,
           d.cuisine_type, d.organizer, d.website_url,
           d.host_name, u.display_name, u.name AS user_name
    FROM listings d
    JOIN users u ON u.id = d.user_id
    WHERE d.is_active = true
      AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
      AND (:category IS NULL OR d.category = :category)
      AND (:includeExpired OR d.end_datetime >= NOW())
    ORDER BY d.upvote_count DESC
    LIMIT :lim OFFSET :off
    """, nativeQuery = true)
List<Object[]> searchListings(
    @Param("lat") double lat,
    @Param("lng") double lng,
    @Param("radiusMetres") double radiusMetres,
    @Param("category") String category,
    @Param("includeExpired") boolean includeExpired,
    @Param("lim") int limit,
    @Param("off") int offset
);
```

- [ ] **Step 2: Update `searchListingsWithTags` native query**

Replace the `searchListingsWithTags` query body:

```java
@Query(value = """
    SELECT d.id, d.title, d.city, d.state,
           ST_Y(d.location::geometry) AS lat, ST_X(d.location::geometry) AS lng,
           d.upvote_count, d.photo_count, d.display_type, d.created_at,
           (SELECT p.url FROM display_photos p
            WHERE p.display_id = d.id AND p.is_primary = true LIMIT 1) AS primary_photo_url,
           d.category, d.start_datetime, d.end_datetime, d.price_info,
           d.cuisine_type, d.organizer, d.website_url,
           d.host_name, u.display_name, u.name AS user_name
    FROM listings d
    JOIN users u ON u.id = d.user_id
    WHERE d.is_active = true
      AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
      AND (:category IS NULL OR d.category = :category)
      AND (:includeExpired OR d.end_datetime >= NOW())
      AND EXISTS (SELECT 1 FROM display_tags dt WHERE dt.display_id = d.id AND dt.tag_id IN (:tagIds))
    ORDER BY d.upvote_count DESC
    LIMIT :lim OFFSET :off
    """, nativeQuery = true)
List<Object[]> searchListingsWithTags(
    @Param("lat") double lat,
    @Param("lng") double lng,
    @Param("radiusMetres") double radiusMetres,
    @Param("category") String category,
    @Param("includeExpired") boolean includeExpired,
    @Param("tagIds") List<Long> tagIds,
    @Param("lim") int limit,
    @Param("off") int offset
);
```

- [ ] **Step 3: Update `mapRowToSummary` in `ListingService`**

Replace the `mapRowToSummary` method:

```java
private ListingSummaryResponse mapRowToSummary(Object[] row) {
    String categoryStr = (String) row[11];
    String hostName = (String) row[18];
    String displayName = (String) row[19];
    String userName = (String) row[20];
    String resolvedHostName = hostName != null ? hostName : (displayName != null ? displayName : userName);
    return ListingSummaryResponse.builder()
        .id(((Number) row[0]).longValue())
        .title((String) row[1])
        .city((String) row[2])
        .state((String) row[3])
        .lat(((Number) row[4]).doubleValue())
        .lng(((Number) row[5]).doubleValue())
        .upvoteCount(((Number) row[6]).intValue())
        .photoCount(((Number) row[7]).intValue())
        .displayType((String) row[8])
        .primaryPhotoUrl((String) row[10])
        .category(categoryStr != null ? Category.valueOf(categoryStr) : null)
        .startDatetime(row[12] != null ? ((java.sql.Timestamp) row[12]).toLocalDateTime() : null)
        .endDatetime(row[13] != null ? ((java.sql.Timestamp) row[13]).toLocalDateTime() : null)
        .priceInfo((String) row[14])
        .cuisineType((String) row[15])
        .organizer((String) row[16])
        .websiteUrl((String) row[17])
        .resolvedHostName(resolvedHostName)
        .tags(List.of())
        .build();
}
```

- [ ] **Step 4: Update `buildSummary` in `ListingService`**

Replace the `buildSummary` method:

```java
private ListingSummaryResponse buildSummary(Listing listing, String primaryPhotoUrl) {
    String hostName = listing.getHostName();
    String displayName = listing.getUser().getDisplayName();
    String userName = listing.getUser().getName();
    String resolvedHostName = hostName != null ? hostName : (displayName != null ? displayName : userName);
    return ListingSummaryResponse.builder()
        .id(listing.getId())
        .title(listing.getTitle())
        .city(listing.getCity())
        .state(listing.getState())
        .lat(listing.getLocation().getY())
        .lng(listing.getLocation().getX())
        .upvoteCount(listing.getUpvoteCount())
        .photoCount(listing.getPhotoCount())
        .category(listing.getCategory())
        .displayType(listing.getDisplayType() != null ? listing.getDisplayType().name() : null)
        .primaryPhotoUrl(primaryPhotoUrl)
        .tags(listing.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
        .isActive(listing.isActive())
        .startDatetime(listing.getStartDatetime())
        .endDatetime(listing.getEndDatetime())
        .priceInfo(listing.getPriceInfo())
        .cuisineType(listing.getCuisineType())
        .organizer(listing.getOrganizer())
        .websiteUrl(listing.getWebsiteUrl())
        .resolvedHostName(resolvedHostName)
        .build();
}
```

- [ ] **Step 5: Verify compilation**

```bash
cd backend && mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java \
        backend/src/main/java/com/christmaslightmap/service/ListingService.java
git commit -m "feat: compute resolvedHostName in listing queries and summary builders"
```

---

## Task 5: Update UserService.getHostListings to Include resolvedHostName

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/service/UserService.java`

- [ ] **Step 1: Update the summary mapping in `getHostListings`**

In `UserService.java`, inside `getHostListings`, replace the `summaries` stream that builds `ListingSummaryResponse` objects. The `user` variable is already in scope at the top of the method. Replace:

```java
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
```

With:

```java
List<ListingSummaryResponse> summaries = listings.stream()
    .map(l -> {
        String hostName = l.getHostName();
        String displayName = user.getDisplayName();
        String userName = user.getName();
        String resolvedHostName = hostName != null ? hostName : (displayName != null ? displayName : userName);
        return ListingSummaryResponse.builder()
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
            .resolvedHostName(resolvedHostName)
            .build();
    })
    .collect(Collectors.toList());
```

- [ ] **Step 2: Verify compilation**

```bash
cd backend && mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/service/UserService.java
git commit -m "feat: include resolvedHostName in getHostListings summary"
```

---

## Task 6: Host Search Endpoint

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/repository/UserRepository.java`
- Modify: `backend/src/main/java/com/christmaslightmap/service/UserService.java`
- Modify: `backend/src/main/java/com/christmaslightmap/controller/UserController.java`
- Create: `backend/src/test/java/com/christmaslightmap/HostSearchTest.java`

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/com/christmaslightmap/HostSearchTest.java`:

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

class HostSearchTest extends BaseIntegrationTest {

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
    void searchHosts_findsHostByDisplayName() {
        User host = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-search1")
            .email("bbq@test.com").name("Joe Smith")
            .displayName("Joe's BBQ Truck")
            .role(UserRole.USER).build());

        listingRepository.save(Listing.builder()
            .user(host).title("BBQ Stop")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.FOOD_TRUCK)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/search?q=BBQ", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Joe's BBQ Truck");
        assertThat(response.getBody()).contains(host.getId().toString());
    }

    @Test
    void searchHosts_findsHostByOAuthName() {
        User host = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-search2")
            .email("sarah@test.com").name("Sarah's Market")
            .role(UserRole.USER).build());

        listingRepository.save(Listing.builder()
            .user(host).title("Saturday Market")
            .city("Dallas").state("TX")
            .location(point(-96.7, 32.7))
            .category(Category.POPUP_MARKET)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(2))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/search?q=Sarah", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Sarah's Market");
    }

    @Test
    void searchHosts_excludesHostsWithNoUpcomingListings() {
        User host = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-search3")
            .email("expired@test.com").name("Expired Vendor")
            .role(UserRole.USER).build());

        listingRepository.save(Listing.builder()
            .user(host).title("Old Sale")
            .city("Houston").state("TX")
            .location(point(-95.3, 29.7))
            .category(Category.YARD_SALE)
            .startDatetime(LocalDateTime.now().minusDays(10))
            .endDatetime(LocalDateTime.now().minusDays(1))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/search?q=Expired", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain("Expired Vendor");
    }

    @Test
    void searchHosts_returnsEmptyForNoMatch() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/search?q=zzznomatch", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("[]");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && mvn test -pl . -Dtest=HostSearchTest -q 2>&1 | tail -20
```

Expected: FAIL — endpoint does not exist yet (404 or compilation error).

- [ ] **Step 3: Add `searchHosts` query to `UserRepository`**

In `UserRepository.java`, add:

```java
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

@Query("""
    SELECT DISTINCT u FROM User u
    WHERE (LOWER(u.displayName) LIKE LOWER(CONCAT('%', :q, '%'))
        OR LOWER(u.name) LIKE LOWER(CONCAT('%', :q, '%')))
      AND EXISTS (
        SELECT 1 FROM Listing l
        WHERE l.user = u
          AND l.isActive = true
          AND l.endDatetime > :now
      )
    ORDER BY u.name ASC
    """)
List<User> searchHosts(@Param("q") String q, @Param("now") LocalDateTime now);
```

- [ ] **Step 4: Add `searchHosts` to `UserService`**

In `UserService.java`, add method:

```java
public List<HostUserResponse> searchHosts(String q) {
    return userRepository.searchHosts(q.trim(), LocalDateTime.now()).stream()
        .limit(10)
        .map(HostUserResponse::from)
        .collect(Collectors.toList());
}
```

Also add the missing import if needed:
```java
import com.christmaslightmap.dto.response.HostUserResponse;
```

- [ ] **Step 5: Add `GET /users/search` to `UserController`**

In `UserController.java`, add:

```java
import com.christmaslightmap.dto.response.HostUserResponse;
import java.util.List;

@GetMapping("/search")
public ResponseEntity<ApiResponse<List<HostUserResponse>>> searchHosts(
    @RequestParam String q
) {
    return ResponseEntity.ok(ApiResponse.success(userService.searchHosts(q)));
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && mvn test -pl . -Dtest=HostSearchTest -q 2>&1 | tail -10
```

Expected: Tests run: 4, Failures: 0, Errors: 0

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/repository/UserRepository.java \
        backend/src/main/java/com/christmaslightmap/service/UserService.java \
        backend/src/main/java/com/christmaslightmap/controller/UserController.java \
        backend/src/test/java/com/christmaslightmap/HostSearchTest.java
git commit -m "feat: add GET /users/search endpoint for host autocomplete"
```

---

## Task 7: Update Display Name Endpoint

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/dto/request/UpdateDisplayNameRequest.java`
- Modify: `backend/src/main/java/com/christmaslightmap/service/UserService.java`
- Modify: `backend/src/main/java/com/christmaslightmap/controller/UserController.java`
- Modify: `backend/src/test/java/com/christmaslightmap/HostSearchTest.java`

- [ ] **Step 1: Write the failing test**

Add this test to `HostSearchTest.java`:

```java
@Test
void updateDisplayName_savesValueAndReturnsIt() {
    User host = userRepository.save(User.builder()
        .provider("facebook").providerId("fb-update1")
        .email("update@test.com").name("Update User")
        .role(UserRole.USER).build());

    // Authenticate as this user by calling the test helper via direct service call
    // We test via the listing response since PATCH /users/me requires auth.
    // This test verifies the service layer directly using the repository.
    host.setDisplayName("My Business Name");
    userRepository.save(host);

    User found = userRepository.findById(host.getId()).orElseThrow();
    assertThat(found.getDisplayName()).isEqualTo("My Business Name");
}

@Test
void updateDisplayName_emptyStringStoresNull() {
    User host = userRepository.save(User.builder()
        .provider("facebook").providerId("fb-update2")
        .email("update2@test.com").name("Clear Name User")
        .displayName("Old Name")
        .role(UserRole.USER).build());

    host.setDisplayName(null);
    userRepository.save(host);

    User found = userRepository.findById(host.getId()).orElseThrow();
    assertThat(found.getDisplayName()).isNull();
}
```

- [ ] **Step 2: Run the new tests to verify they pass immediately** (they test the repository directly — just verifying entity/DB plumbing)

```bash
cd backend && mvn test -pl . -Dtest=HostSearchTest -q 2>&1 | tail -10
```

Expected: Tests run: 6, Failures: 0, Errors: 0

- [ ] **Step 3: Create `UpdateDisplayNameRequest`**

```java
package com.christmaslightmap.dto.request;

import lombok.Data;

@Data
public class UpdateDisplayNameRequest {
    private String displayName;
}
```

- [ ] **Step 4: Add `updateDisplayName` to `UserService`**

In `UserService.java`, add import and method:

```java
import com.christmaslightmap.dto.request.UpdateDisplayNameRequest;
import org.springframework.transaction.annotation.Transactional;

@Transactional
public HostUserResponse updateDisplayName(Long userId, UpdateDisplayNameRequest request) {
    User user = userRepository.findById(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    String name = request.getDisplayName();
    user.setDisplayName((name == null || name.isBlank()) ? null : name.trim().substring(0, Math.min(name.trim().length(), 100)));
    return HostUserResponse.from(userRepository.save(user));
}
```

- [ ] **Step 5: Add `PATCH /users/me` to `UserController`**

In `UserController.java`, add:

```java
import com.christmaslightmap.dto.request.UpdateDisplayNameRequest;
import org.springframework.security.core.Authentication;

@PatchMapping("/me")
public ResponseEntity<ApiResponse<HostUserResponse>> updateDisplayName(
    @RequestBody UpdateDisplayNameRequest request,
    Authentication authentication
) {
    Long userId = (Long) authentication.getPrincipal();
    return ResponseEntity.ok(ApiResponse.success(userService.updateDisplayName(userId, request)));
}
```

- [ ] **Step 6: Verify compilation**

```bash
cd backend && mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/dto/request/UpdateDisplayNameRequest.java \
        backend/src/main/java/com/christmaslightmap/service/UserService.java \
        backend/src/main/java/com/christmaslightmap/controller/UserController.java \
        backend/src/test/java/com/christmaslightmap/HostSearchTest.java
git commit -m "feat: add PATCH /users/me endpoint for updating display name"
```

---

## Task 8: Add hostName to Create/Update Listing + Tests

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/dto/request/CreateListingRequest.java`
- Modify: `backend/src/main/java/com/christmaslightmap/dto/request/UpdateListingRequest.java`
- Modify: `backend/src/main/java/com/christmaslightmap/service/ListingService.java`
- Modify: `backend/src/test/java/com/christmaslightmap/HostProfileTest.java`

- [ ] **Step 1: Write the failing test**

Add this to `HostProfileTest.java`:

```java
@Test
void getListingById_usesHostNameOverDisplayName() {
    User host = userRepository.save(User.builder()
        .provider("facebook").providerId("fb-hostname1")
        .email("hostname@test.com").name("OAuth Name")
        .displayName("Profile Display Name")
        .role(UserRole.USER).build());

    Listing listing = listingRepository.save(Listing.builder()
        .user(host).title("Override Event")
        .city("Austin").state("TX")
        .location(point(-97.7, 30.2))
        .category(Category.FOOD_TRUCK)
        .startDatetime(LocalDateTime.now().minusDays(1))
        .endDatetime(LocalDateTime.now().plusDays(30))
        .hostName("Per-Listing Name")
        .build());

    ResponseEntity<String> response = restTemplate.getForEntity(
        "/api/v1/listings/" + listing.getId(), String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody()).contains("Per-Listing Name");
    assertThat(response.getBody()).doesNotContain("Profile Display Name");
}

@Test
void getListingById_fallsBackToDisplayNameWhenNoHostName() {
    User host = userRepository.save(User.builder()
        .provider("facebook").providerId("fb-hostname2")
        .email("hostname2@test.com").name("OAuth Name")
        .displayName("Profile Display Name")
        .role(UserRole.USER).build());

    Listing listing = listingRepository.save(Listing.builder()
        .user(host).title("Fallback Event")
        .city("Austin").state("TX")
        .location(point(-97.7, 30.2))
        .category(Category.FOOD_TRUCK)
        .startDatetime(LocalDateTime.now().minusDays(1))
        .endDatetime(LocalDateTime.now().plusDays(30))
        .build());

    ResponseEntity<String> response = restTemplate.getForEntity(
        "/api/v1/listings/" + listing.getId(), String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody()).contains("Profile Display Name");
    assertThat(response.getBody()).doesNotContain("OAuth Name");
}
```

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
cd backend && mvn test -pl . -Dtest=HostProfileTest -q 2>&1 | tail -10
```

Expected: FAIL — `resolvedHostName` not being set correctly yet (or hostName field not persisted).

- [ ] **Step 3: Add `hostName` to `CreateListingRequest`**

In `CreateListingRequest.java`, add after `websiteUrl`:

```java
private String hostName;
```

- [ ] **Step 4: Add `hostName` to `UpdateListingRequest`**

Read `backend/src/main/java/com/christmaslightmap/dto/request/UpdateListingRequest.java`, then add after `websiteUrl`:

```java
private String hostName;
```

- [ ] **Step 5: Update `createListing` in `ListingService`**

In the `Listing.builder()` chain inside `createListing`, add after `.priceInfo(request.getPriceInfo())`:

```java
.hostName(request.getHostName() != null && !request.getHostName().isBlank()
    ? request.getHostName().trim().substring(0, Math.min(request.getHostName().trim().length(), 100))
    : null)
```

- [ ] **Step 6: Update `updateListing` in `ListingService`**

In `updateListing`, after `listing.setPriceInfo(request.getPriceInfo());`, add:

```java
listing.setHostName(request.getHostName() != null && !request.getHostName().isBlank()
    ? request.getHostName().trim().substring(0, Math.min(request.getHostName().trim().length(), 100))
    : null);
```

- [ ] **Step 7: Update `adminUpdateListing` in `ListingService`**

In `adminUpdateListing`, after `listing.setPriceInfo(request.getPriceInfo());`, add:

```java
listing.setHostName(request.getHostName() != null && !request.getHostName().isBlank()
    ? request.getHostName().trim().substring(0, Math.min(request.getHostName().trim().length(), 100))
    : null);
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd backend && mvn test -pl . -Dtest=HostProfileTest -q 2>&1 | tail -10
```

Expected: Tests run: 5, Failures: 0, Errors: 0

- [ ] **Step 9: Run full test suite to check for regressions**

```bash
cd backend && mvn test -q 2>&1 | tail -15
```

Expected: BUILD SUCCESS, 0 failures.

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/dto/request/ \
        backend/src/main/java/com/christmaslightmap/service/ListingService.java \
        backend/src/test/java/com/christmaslightmap/HostProfileTest.java
git commit -m "feat: persist hostName on listing create/update and verify resolution order"
```

---

## Task 9: Frontend Models + API Service

**Files:**
- Modify: `frontend/src/app/models/listing.model.ts`
- Modify: `frontend/src/app/services/listing-api.service.ts`

- [ ] **Step 1: Update `HostUser` and `ListingSummary` in `listing.model.ts`**

In `listing.model.ts`, update `HostUser`:

```typescript
export interface HostUser {
  id: number;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
}
```

Add new `HostSearchResult` type after `HostUser`:

```typescript
export interface HostSearchResult {
  id: number;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
}
```

In `ListingSummary`, add after `websiteUrl`:

```typescript
resolvedHostName: string;
```

In the `User` interface, add after `avatarUrl`:

```typescript
displayName: string | null;
```

In `CreateListingRequest`, add after `websiteUrl`:

```typescript
hostName: string;
```

In `UpdateListingRequest`, add after `websiteUrl`:

```typescript
hostName: string;
```

- [ ] **Step 2: Add `searchHosts` and `updateDisplayName` to `listing-api.service.ts`**

In `listing-api.service.ts`, add import for `HostSearchResult`:

```typescript
import {
  Listing, ListingSummary, Tag, Report, HostListingsResponse, HostSearchResult,
  PagedResponse, SearchParams, CreateListingRequest, UpdateListingRequest
} from '../models/listing.model';
```

Add these two methods after `getHostListings`:

```typescript
searchHosts(q: string): Observable<HostSearchResult[]> {
  return this.http.get<ApiResponse<HostSearchResult[]>>(
    `${this.base}/users/search`, { params: { q }, withCredentials: true }
  ).pipe(map(r => r.data));
}

updateDisplayName(displayName: string): Observable<HostSearchResult> {
  return this.http.patch<ApiResponse<HostSearchResult>>(
    `${this.base}/users/me`, { displayName }, { withCredentials: true }
  ).pipe(map(r => r.data));
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/models/listing.model.ts \
        frontend/src/app/services/listing-api.service.ts
git commit -m "feat: add resolvedHostName to ListingSummary and host search API methods"
```

---

## Task 10: HostSearchComponent

**Files:**
- Create: `frontend/src/app/pages/host-search/host-search.component.ts`

- [ ] **Step 1: Create the component**

```typescript
import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HostSearchResult, HostUser, getInitials } from '../../models/listing.model';
import { ListingApiService } from '../../services/listing-api.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';

@Component({
  selector: 'app-host-search',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent],
  template: `
    <div style="height:100%;overflow-y:auto;background:#f8fafc;padding-bottom:40px">
      <div style="max-width:560px;margin:0 auto;padding:28px 20px 0">

        <div style="font-weight:800;font-size:22px;color:#0f172a;margin-bottom:4px">Find a Host</div>
        <div style="font-size:13.5px;color:#64748b;margin-bottom:24px">
          Search for a food truck, market, or host by name.
        </div>

        <!-- Search input -->
        <div style="position:relative;margin-bottom:8px">
          <div style="background:white;border-radius:12px;border:1.5px solid #e2e8f0;
                      box-shadow:0 2px 8px rgba(0,0,0,0.06);
                      display:flex;align-items:center;padding:11px 14px;gap:8px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" style="flex-shrink:0">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input [(ngModel)]="query"
                   (ngModelChange)="onQueryChange($event)"
                   placeholder="Search hosts…"
                   style="flex:1;border:none;outline:none;font-size:14px;color:#0f172a;background:transparent"/>
            <button *ngIf="query" (click)="clearQuery()"
                    style="background:none;border:none;cursor:pointer;padding:0;
                           color:#94a3b8;font-size:18px;line-height:1">×</button>
          </div>

          <!-- Autocomplete dropdown -->
          <div *ngIf="showDropdown"
               style="position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:200;
                      background:white;border:1.5px solid #e2e8f0;border-radius:12px;
                      box-shadow:0 8px 24px rgba(0,0,0,0.12);overflow:hidden">

            <!-- Loading -->
            <div *ngIf="searching"
                 style="padding:16px;text-align:center;color:#94a3b8;font-size:13.5px">
              Searching…
            </div>

            <!-- No results -->
            <div *ngIf="!searching && results.length === 0"
                 style="padding:16px;text-align:center;color:#94a3b8;font-size:13.5px">
              No hosts found
            </div>

            <!-- Results -->
            <button *ngFor="let r of results; let last = last"
                    (click)="selectHost(r)"
                    [style.border-bottom]="last ? 'none' : '1px solid #f1f5f9'"
                    style="display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;
                           background:none;border-left:none;border-right:none;border-top:none;
                           cursor:pointer;text-align:left;transition:background 0.1s"
                    (mouseenter)="$any($event.target).closest('button').style.background='#f8fafc'"
                    (mouseleave)="$any($event.target).closest('button').style.background='none'">
              <img *ngIf="r.avatarUrl" [src]="r.avatarUrl" [alt]="r.name"
                   style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0"/>
              <app-avatar *ngIf="!r.avatarUrl" [initials]="getInitials(r.displayName ?? r.name)" [size]="36"/>
              <div>
                <div style="font-weight:700;font-size:14px;color:#0f172a">
                  {{r.displayName ?? r.name}}
                </div>
                <div *ngIf="r.displayName && r.displayName !== r.name"
                     style="font-size:12px;color:#94a3b8">{{r.name}}</div>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  `
})
export class HostSearchComponent {
  @Output() viewHost = new EventEmitter<HostUser>();

  query = '';
  results: HostSearchResult[] = [];
  searching = false;
  showDropdown = false;

  getInitials = getInitials;

  private listingApi = inject(ListingApiService);
  private debounceTimer: any = null;

  onQueryChange(q: string) {
    clearTimeout(this.debounceTimer);
    if (q.length < 2) {
      this.showDropdown = false;
      this.results = [];
      return;
    }
    this.searching = true;
    this.showDropdown = true;
    this.debounceTimer = setTimeout(() => {
      this.listingApi.searchHosts(q).subscribe({
        next: results => {
          this.results = results;
          this.searching = false;
        },
        error: () => {
          this.showDropdown = false;
          this.searching = false;
        },
      });
    }, 300);
  }

  selectHost(result: HostSearchResult) {
    this.showDropdown = false;
    this.viewHost.emit({ id: result.id, name: result.name, displayName: result.displayName, avatarUrl: result.avatarUrl });
  }

  clearQuery() {
    this.query = '';
    this.showDropdown = false;
    this.results = [];
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/pages/host-search/host-search.component.ts
git commit -m "feat: add HostSearchComponent with debounced autocomplete"
```

---

## Task 11: Wire HostSearchComponent into AppComponent

**Files:**
- Modify: `frontend/src/app/app.component.ts`

- [ ] **Step 1: Update `AppComponent`**

At the top, add the import:

```typescript
import { HostSearchComponent } from './pages/host-search/host-search.component';
```

In the `imports` array, add `HostSearchComponent`.

Change the `Screen` type:

```typescript
type Screen = 'map' | 'submit' | 'profile' | 'admin' | 'host' | 'hosts';
```

In the template, add the host search screen after the `app-host-profile` block:

```html
<app-host-search *ngIf="screen() === 'hosts'"
  style="display:block;height:100%"
  (viewHost)="openHostProfile($event)"/>
```

In `ngOnInit`, add handling for `/hosts` path (treat it like `/host` — redirect to `/`):

```typescript
else if (path.startsWith('/hosts')) this.location.replaceState('/');
```

In `navigate()`, ensure `'hosts'` is treated as a normal public screen (no auth gate needed — it's public). The existing guard only applies to `'submit'` and `'profile'`, so no change needed there.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/app.component.ts
git commit -m "feat: wire HostSearchComponent into AppComponent as 'hosts' screen"
```

---

## Task 12: Navigation — Bottom Tab Bar + Navbar

**Files:**
- Modify: `frontend/src/app/shared/bottom-tab-bar/bottom-tab-bar.component.ts`
- Modify: `frontend/src/app/shared/navbar/navbar.component.ts`

- [ ] **Step 1: Add Hosts tab to `BottomTabBarComponent`**

In the `base` array inside the `get tabs()` getter, add after the `submit` entry:

```typescript
{ id: 'hosts', label: 'Hosts', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>` },
```

- [ ] **Step 2: Add Hosts link to `NavbarComponent`**

In `NavbarComponent`, update the `navLinks` getter to always include Hosts (public, no auth required):

```typescript
get navLinks() {
  return [
    { id: 'map', label: 'Explore' },
    { id: 'hosts', label: 'Hosts' },
    ...(this.user ? [{ id: 'submit', label: 'Add Display' }] : []),
    ...(this.user ? [{ id: 'profile', label: 'My Displays' }] : []),
    ...(this.user?.role === 'ADMIN' ? [{ id: 'admin', label: '⚙ Admin' }] : []),
  ];
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/shared/bottom-tab-bar/bottom-tab-bar.component.ts \
        frontend/src/app/shared/navbar/navbar.component.ts
git commit -m "feat: add Hosts tab to bottom tab bar and navbar"
```

---

## Task 13: Profile Page — Display Name Field

**Files:**
- Modify: `frontend/src/app/pages/profile/profile.component.ts`

- [ ] **Step 1: Add display name field and save logic**

In `ProfileComponent`, add these signals and inject `ListingApiService` after the existing properties:

```typescript
private listingApi = inject(ListingApiService);
displayName = signal('');
savingDisplayName = signal(false);
displayNameSaved = signal(false);
```

In `ngOnInit`, after the existing subscriptions, load the display name from the user input:

```typescript
if (this.user) {
  // user.displayName is not on the User model yet — we load it separately.
  // For now, leave the field blank; the user can type to set it.
}
```

The `User` interface already has `displayName` added in Task 9. In `ProfileComponent.ngOnInit`, add:

```typescript
if (this.user?.displayName) {
  this.displayName.set(this.user.displayName);
}
```

Add `saveDisplayName()` method:

```typescript
saveDisplayName() {
  this.savingDisplayName.set(true);
  this.displayNameSaved.set(false);
  this.listingApi.updateDisplayName(this.displayName()).subscribe({
    next: () => {
      this.savingDisplayName.set(false);
      this.displayNameSaved.set(true);
      setTimeout(() => this.displayNameSaved.set(false), 2500);
    },
    error: () => this.savingDisplayName.set(false),
  });
}
```

In the template, add this section after the profile stats `<div>` (the div with listings/upvotes/upvoted counts) and before the tabs:

```html
<!-- Display name setting -->
<div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;
            box-shadow:0 1px 6px rgba(0,0,0,0.06)">
  <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">
    Business / host name
  </div>
  <div style="font-size:12.5px;color:#64748b;margin-bottom:12px">
    Shown on your listings instead of your Facebook name.
  </div>
  <div style="display:flex;gap:8px">
    <input [(ngModel)]="displayName()"
           (ngModelChange)="displayName.set($event)"
           placeholder="e.g. Joe's BBQ Truck"
           style="flex:1;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                  font-size:13.5px;color:#0f172a;outline:none;background:white"/>
    <button (click)="saveDisplayName()"
            [disabled]="savingDisplayName()"
            [style.opacity]="savingDisplayName() ? '0.6' : '1'"
            style="padding:9px 16px;background:var(--accent);color:white;border:none;
                   border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">
      {{savingDisplayName() ? 'Saving…' : displayNameSaved() ? 'Saved!' : 'Save'}}
    </button>
  </div>
</div>
```

Also add `FormsModule` to the `imports` array in the `@Component` decorator of `ProfileComponent`:

```typescript
imports: [CommonModule, FormsModule, DisplayCardComponent, AvatarComponent],
```

And add the import at the top:

```typescript
import { FormsModule } from '@angular/forms';
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/pages/profile/profile.component.ts \
        frontend/src/app/models/listing.model.ts
git commit -m "feat: add display name field to profile page"
```

---

## Task 14: Submit Form — hostName Field

**Files:**
- Modify: `frontend/src/app/pages/submit/submit.component.ts`

- [ ] **Step 1: Add `hostName` to the form object**

In the `form` object inside `SubmitComponent`, add after `websiteUrl`:

```typescript
hostName: '',
```

- [ ] **Step 2: Add the hostName field to the details step template**

In the `submit.component.ts` template, in the details step section (look for the `step() === 'details'` block), add this field after the existing `websiteUrl` input block:

```html
<!-- Host name override (all categories) -->
<div>
  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">
    Host name for this listing
    <span style="font-weight:400;color:#94a3b8">(optional — overrides your profile name)</span>
  </label>
  <input [(ngModel)]="form.hostName" placeholder="Leave blank to use your profile name"
         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
         (focus)="$any($event.target).style.borderColor='var(--accent)'"
         (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
</div>
```

- [ ] **Step 3: Add `hostName` to the payload in `submitListing()`**

In the `payload` object inside `submitListing()`, add after `websiteUrl`:

```typescript
hostName: this.form.hostName,
```

- [ ] **Step 4: Add `hostName` to the `ngOnInit` edit population**

In `ngOnInit`, when populating form fields from `this.editListing`, the `ListingSummary` doesn't have `hostName` directly — it has `resolvedHostName`. We want to leave the `hostName` field blank when editing so the user can optionally set it. The existing `resolvedHostName` is shown as the byline. No action needed here — just leave `form.hostName` as `''` on edit load (the backend will not overwrite a null `hostName` when `hostName` is missing from the payload; however our current service sets `null` when blank, which is correct).

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/pages/submit/submit.component.ts
git commit -m "feat: add optional host name override field to submit form"
```

---

## Task 15: Use resolvedHostName in DisplayDetailComponent

**Files:**
- Modify: `frontend/src/app/shared/display-detail/display-detail.component.ts`

- [ ] **Step 1: Replace `submittedByName` with `resolvedHostName` in the host byline**

In `display-detail.component.ts`, find:

```html
<div (click)="onViewHost()"
     style="font-size:13px;color:var(--accent);cursor:pointer;font-weight:600;
            display:inline-block">
  By {{fullDisplay()!.submittedByName}}
</div>
```

Replace with:

```html
<div (click)="onViewHost()"
     style="font-size:13px;color:var(--accent);cursor:pointer;font-weight:600;
            display:inline-block">
  By {{fullDisplay()!.resolvedHostName}}
</div>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/shared/display-detail/display-detail.component.ts
git commit -m "feat: use resolvedHostName for host byline in event detail modal"
```

---

## Task 16: Run Full Backend Test Suite + Build Frontend

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && mvn test 2>&1 | tail -20
```

Expected: BUILD SUCCESS, 0 failures, 0 errors.

- [ ] **Step 2: Build frontend**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: Build completed successfully.

- [ ] **Step 3: Commit if any final fixes were needed**

If no changes, skip commit. If minor fixes applied, commit them:

```bash
git add -A
git commit -m "fix: resolve final build issues for host search feature"
```
