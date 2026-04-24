# Community Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand from a Christmas-lights-only map to a unified community board supporting Christmas Lights, Yard/Garage Sales, Estate Sales, Pop-up Markets, and Food Trucks — all on one map with start/end dates and category-specific fields.

**Architecture:** Single `listings` table (renamed from `displays`) with a `category` enum column and nullable category-specific columns. A `end_datetime` column auto-hides expired listings server-side. The frontend shows/hides fields per category. All existing Christmas lights data is migrated in-place.

**Tech Stack:** Spring Boot 3.5 / JPA+Hibernate / PostgreSQL+PostGIS / Flyway migrations / Angular 17 standalone components / signals

---

## File Map

**Create:**
- `backend/src/main/resources/db/migration/V12__migrate_displays_to_listings.sql`
- `backend/src/main/java/com/christmaslightmap/model/Category.java`
- `backend/src/main/java/com/christmaslightmap/model/Listing.java`
- `backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java`
- `backend/src/main/java/com/christmaslightmap/dto/request/CreateListingRequest.java`
- `backend/src/main/java/com/christmaslightmap/dto/response/ListingSummaryResponse.java`
- `backend/src/main/java/com/christmaslightmap/dto/response/ListingResponse.java`
- `backend/src/main/java/com/christmaslightmap/service/ListingService.java`
- `backend/src/main/java/com/christmaslightmap/controller/ListingController.java`
- `backend/src/test/java/com/christmaslightmap/ListingSearchTest.java`
- `frontend/src/app/models/listing.model.ts`
- `frontend/src/app/services/listing-api.service.ts`

**Modify:**
- `backend/src/main/java/com/christmaslightmap/model/Upvote.java`
- `backend/src/main/java/com/christmaslightmap/model/Report.java`
- `backend/src/main/java/com/christmaslightmap/model/DisplayPhoto.java`
- `backend/src/main/java/com/christmaslightmap/repository/UpvoteRepository.java`
- `backend/src/main/java/com/christmaslightmap/service/PhotoService.java`
- `backend/src/main/java/com/christmaslightmap/service/ReportService.java`
- `backend/src/main/java/com/christmaslightmap/service/UpvoteService.java`
- `backend/src/main/java/com/christmaslightmap/service/AdminService.java`
- `backend/src/main/java/com/christmaslightmap/controller/AdminController.java`
- `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java`
- `frontend/src/app/app.component.ts`
- `frontend/src/app/pages/map/map.component.ts`
- `frontend/src/app/pages/submit/submit.component.ts`
- `frontend/src/app/pages/profile/profile.component.ts`
- `frontend/src/app/pages/admin/admin.component.ts`
- `frontend/src/app/shared/display-detail/display-detail.component.ts`
- `frontend/src/app/shared/navbar/navbar.component.ts`

**Delete (after all references updated):**
- `backend/src/main/java/com/christmaslightmap/model/Display.java`
- `backend/src/main/java/com/christmaslightmap/repository/DisplayRepository.java`
- `backend/src/main/java/com/christmaslightmap/service/DisplayService.java`
- `backend/src/main/java/com/christmaslightmap/controller/DisplayController.java`
- `backend/src/main/java/com/christmaslightmap/dto/request/CreateDisplayRequest.java`
- `backend/src/main/java/com/christmaslightmap/dto/response/DisplaySummaryResponse.java`
- `backend/src/main/java/com/christmaslightmap/dto/response/DisplayResponse.java`
- `backend/src/test/java/com/christmaslightmap/DisplaySearchTest.java`

---

## Task 1: Flyway V12 Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V12__migrate_displays_to_listings.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Rename table
ALTER TABLE displays RENAME TO listings;

-- Rename primary index
ALTER INDEX idx_displays_location RENAME TO idx_listings_location;
ALTER INDEX idx_displays_active RENAME TO idx_listings_active;

-- Update foreign keys in child tables to point at renamed table
ALTER TABLE display_photos
  DROP CONSTRAINT IF EXISTS display_photos_display_id_fkey,
  ADD CONSTRAINT display_photos_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES listings(id) ON DELETE CASCADE;

ALTER TABLE upvotes
  DROP CONSTRAINT IF EXISTS upvotes_display_id_fkey,
  ADD CONSTRAINT upvotes_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES listings(id) ON DELETE CASCADE;

ALTER TABLE display_tags
  DROP CONSTRAINT IF EXISTS display_tags_display_id_fkey,
  ADD CONSTRAINT display_tags_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES listings(id) ON DELETE CASCADE;

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_display_id_fkey,
  ADD CONSTRAINT reports_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES listings(id) ON DELETE CASCADE;

-- Make display_type nullable (non-lights categories won't have it)
ALTER TABLE listings ALTER COLUMN display_type DROP NOT NULL;

-- Add new columns
ALTER TABLE listings
  ADD COLUMN category       VARCHAR(30),
  ADD COLUMN start_datetime TIMESTAMP,
  ADD COLUMN end_datetime   TIMESTAMP,
  ADD COLUMN cuisine_type   VARCHAR(100),
  ADD COLUMN organizer      VARCHAR(255),
  ADD COLUMN website_url    VARCHAR(500),
  ADD COLUMN price_info     VARCHAR(255);

-- Backfill existing rows
UPDATE listings SET
  category       = 'CHRISTMAS_LIGHTS',
  start_datetime = '2024-12-01 00:00:00',
  end_datetime   = '2025-01-05 23:59:59'
WHERE category IS NULL;

-- Now make required columns non-nullable
ALTER TABLE listings
  ALTER COLUMN category       SET NOT NULL,
  ALTER COLUMN start_datetime SET NOT NULL,
  ALTER COLUMN end_datetime   SET NOT NULL;

-- New indexes for common filters
CREATE INDEX idx_listings_category    ON listings (category);
CREATE INDEX idx_listings_end_datetime ON listings (end_datetime);
```

- [ ] **Step 2: Verify migration applies cleanly**

```bash
cd backend
export $(grep -v '^#' .env | xargs) && mvn spring-boot:run
```

Expected: Spring Boot starts without Flyway errors. Check logs for `Successfully applied 1 migration to schema "public"`.
Ctrl+C to stop.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V12__migrate_displays_to_listings.sql
git commit -m "feat: V12 migrate displays table to listings with category + datetime columns"
```

---

## Task 2: Java Models — Category enum + Listing entity

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/model/Category.java`
- Create: `backend/src/main/java/com/christmaslightmap/model/Listing.java`

Do NOT delete `Display.java` yet — it's still referenced by other classes. That happens in Task 8.

- [ ] **Step 1: Write the failing compile check**

Add a temporary `import com.christmaslightmap.model.Listing;` comment in `BaseIntegrationTest.java` as a reminder — don't actually compile yet. The "test" here is: does the project compile after adding these files?

- [ ] **Step 2: Create `Category.java`**

```java
package com.christmaslightmap.model;

public enum Category {
    CHRISTMAS_LIGHTS,
    YARD_SALE,
    ESTATE_SALE,
    POPUP_MARKET,
    FOOD_TRUCK
}
```

- [ ] **Step 3: Create `Listing.java`**

```java
package com.christmaslightmap.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.locationtech.jts.geom.Point;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "listings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Listing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String title;

    private String description;
    private String address;
    private String city;
    private String state;
    private String postcode;

    @Column(columnDefinition = "geography(Point, 4326)", nullable = false)
    private Point location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Category category;

    @Column(name = "start_datetime", nullable = false)
    private LocalDateTime startDatetime;

    @Column(name = "end_datetime", nullable = false)
    private LocalDateTime endDatetime;

    // Christmas Lights only
    @Column(name = "best_time")
    private String bestTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "display_type")
    private DisplayType displayType;

    // Food Truck only
    @Column(name = "cuisine_type")
    private String cuisineType;

    // Estate Sale only
    @Column(name = "organizer")
    private String organizer;

    // Christmas Lights + Food Truck only
    @Column(name = "website_url")
    private String websiteUrl;

    // Optional for all categories
    @Column(name = "price_info")
    private String priceInfo;

    @Column(name = "upvote_count", nullable = false)
    private int upvoteCount;

    @Column(name = "photo_count", nullable = false)
    private int photoCount;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "display_tags",
        joinColumns = @JoinColumn(name = "display_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    @Builder.Default
    private Set<Tag> tags = new HashSet<>();
}
```

- [ ] **Step 4: Verify compile**

```bash
cd backend
mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/model/Category.java \
        backend/src/main/java/com/christmaslightmap/model/Listing.java
git commit -m "feat: add Category enum and Listing entity"
```

---

## Task 3: New DTOs

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/dto/request/CreateListingRequest.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/ListingSummaryResponse.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/ListingResponse.java`

- [ ] **Step 1: Create `CreateListingRequest.java`**

```java
package com.christmaslightmap.dto.request;

import com.christmaslightmap.model.Category;
import com.christmaslightmap.model.DisplayType;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class CreateListingRequest {
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
    // Christmas Lights only
    private String bestTime;
    private DisplayType displayType;
    private List<Long> tagIds = List.of();
    // Food Truck only
    private String cuisineType;
    // Estate Sale only
    private String organizer;
    // Christmas Lights + Food Truck only
    private String websiteUrl;
}
```

- [ ] **Step 2: Create `ListingSummaryResponse.java`**

```java
package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.Category;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class ListingSummaryResponse {
    private Long id;
    private String title;
    private String city;
    private String state;
    private double lat;
    private double lng;
    private int upvoteCount;
    private int photoCount;
    private Category category;
    private String displayType;
    private String primaryPhotoUrl;
    private List<TagResponse> tags;
    private boolean isActive;
    private LocalDateTime startDatetime;
    private LocalDateTime endDatetime;
    private String priceInfo;
    private String cuisineType;
    private String organizer;
    private String websiteUrl;
}
```

- [ ] **Step 3: Create `ListingResponse.java`**

```java
package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.Category;
import com.christmaslightmap.model.Listing;
import com.christmaslightmap.model.DisplayPhoto;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
public class ListingResponse {
    private Long id;
    private Long submittedBy;
    private String title;
    private String description;
    private String address;
    private String city;
    private String state;
    private String postcode;
    private double lat;
    private double lng;
    private Category category;
    private LocalDateTime startDatetime;
    private LocalDateTime endDatetime;
    private String bestTime;
    private String displayType;
    private String cuisineType;
    private String organizer;
    private String websiteUrl;
    private String priceInfo;
    private int upvoteCount;
    private int photoCount;
    private boolean isActive;
    private LocalDateTime createdAt;
    private List<TagResponse> tags;
    private List<PhotoResponse> photos;

    public static ListingResponse from(Listing listing, List<DisplayPhoto> photos) {
        return ListingResponse.builder()
            .id(listing.getId())
            .submittedBy(listing.getUser().getId())
            .title(listing.getTitle())
            .description(listing.getDescription())
            .address(listing.getAddress())
            .city(listing.getCity())
            .state(listing.getState())
            .postcode(listing.getPostcode())
            .lat(listing.getLocation().getY())
            .lng(listing.getLocation().getX())
            .category(listing.getCategory())
            .startDatetime(listing.getStartDatetime())
            .endDatetime(listing.getEndDatetime())
            .bestTime(listing.getBestTime())
            .displayType(listing.getDisplayType() != null ? listing.getDisplayType().name() : null)
            .cuisineType(listing.getCuisineType())
            .organizer(listing.getOrganizer())
            .websiteUrl(listing.getWebsiteUrl())
            .priceInfo(listing.getPriceInfo())
            .upvoteCount(listing.getUpvoteCount())
            .photoCount(listing.getPhotoCount())
            .isActive(listing.isActive())
            .createdAt(listing.getCreatedAt())
            .tags(listing.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
            .photos(photos.stream().map(PhotoResponse::from).collect(Collectors.toList()))
            .build();
    }
}
```

- [ ] **Step 4: Verify compile**

```bash
cd backend
mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/dto/request/CreateListingRequest.java \
        backend/src/main/java/com/christmaslightmap/dto/response/ListingSummaryResponse.java \
        backend/src/main/java/com/christmaslightmap/dto/response/ListingResponse.java
git commit -m "feat: add CreateListingRequest, ListingSummaryResponse, ListingResponse DTOs"
```

---

## Task 4: ListingRepository + UpvoteRepository JPQL fix

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java`
- Modify: `backend/src/main/java/com/christmaslightmap/repository/UpvoteRepository.java`

- [ ] **Step 1: Create `ListingRepository.java`**

The SQL queries add:
- `FROM listings` (renamed table)
- `d.category, d.start_datetime, d.end_datetime, d.price_info, d.cuisine_type, d.organizer, d.website_url` to SELECT (columns 11–17)
- `AND (:category IS NULL OR d.category = :category)` filter
- `AND (:includeExpired = true OR d.end_datetime >= NOW())` expiry filter

```java
package com.christmaslightmap.repository;

import com.christmaslightmap.model.Listing;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ListingRepository extends JpaRepository<Listing, Long> {

    @Query(value = """
        SELECT d.id, d.title, d.city, d.state,
               ST_Y(d.location::geometry) AS lat, ST_X(d.location::geometry) AS lng,
               d.upvote_count, d.photo_count, d.display_type, d.created_at,
               (SELECT p.url FROM display_photos p
                WHERE p.display_id = d.id AND p.is_primary = true LIMIT 1) AS primary_photo_url,
               d.category, d.start_datetime, d.end_datetime, d.price_info,
               d.cuisine_type, d.organizer, d.website_url
        FROM listings d
        WHERE d.is_active = true
          AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
          AND (:category IS NULL OR d.category = :category)
          AND (:includeExpired = true OR d.end_datetime >= NOW())
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

    @Query(value = """
        SELECT COUNT(*) FROM listings d
        WHERE d.is_active = true
          AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
          AND (:category IS NULL OR d.category = :category)
          AND (:includeExpired = true OR d.end_datetime >= NOW())
        """, nativeQuery = true)
    long countSearchListings(
        @Param("lat") double lat,
        @Param("lng") double lng,
        @Param("radiusMetres") double radiusMetres,
        @Param("category") String category,
        @Param("includeExpired") boolean includeExpired
    );

    @Query(value = """
        SELECT d.id, d.title, d.city, d.state,
               ST_Y(d.location::geometry) AS lat, ST_X(d.location::geometry) AS lng,
               d.upvote_count, d.photo_count, d.display_type, d.created_at,
               (SELECT p.url FROM display_photos p
                WHERE p.display_id = d.id AND p.is_primary = true LIMIT 1) AS primary_photo_url,
               d.category, d.start_datetime, d.end_datetime, d.price_info,
               d.cuisine_type, d.organizer, d.website_url
        FROM listings d
        WHERE d.is_active = true
          AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
          AND (:category IS NULL OR d.category = :category)
          AND (:includeExpired = true OR d.end_datetime >= NOW())
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

    @Query(value = """
        SELECT COUNT(*) FROM listings d
        WHERE d.is_active = true
          AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
          AND (:category IS NULL OR d.category = :category)
          AND (:includeExpired = true OR d.end_datetime >= NOW())
          AND EXISTS (SELECT 1 FROM display_tags dt WHERE dt.display_id = d.id AND dt.tag_id IN (:tagIds))
        """, nativeQuery = true)
    long countSearchListingsWithTags(
        @Param("lat") double lat,
        @Param("lng") double lng,
        @Param("radiusMetres") double radiusMetres,
        @Param("category") String category,
        @Param("includeExpired") boolean includeExpired,
        @Param("tagIds") List<Long> tagIds
    );

    @Query("SELECT d FROM Listing d LEFT JOIN FETCH d.tags WHERE d.id IN :ids")
    List<Listing> findByIdInWithTags(@Param("ids") List<Long> ids);

    List<Listing> findByUserIdAndIsActiveTrue(Long userId);

    Page<Listing> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Listing> findByIsActiveOrderByCreatedAtDesc(boolean isActive, Pageable pageable);
}
```

- [ ] **Step 2: Update `UpvoteRepository.java`**

Change JPQL references from `u.display` → `u.listing`, keeping native SQL column names (`display_id` stays):

```java
package com.christmaslightmap.repository;

import com.christmaslightmap.model.Upvote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface UpvoteRepository extends JpaRepository<Upvote, Long> {
    @Query(value = "SELECT COUNT(*) FROM upvotes WHERE user_id = :userId AND display_id = :listingId", nativeQuery = true)
    long countByUserAndListing(@Param("userId") Long userId, @Param("listingId") Long listingId);

    @Transactional
    @Query("DELETE FROM Upvote u WHERE u.user.id = :userId AND u.listing.id = :listingId")
    @org.springframework.data.jpa.repository.Modifying
    void deleteByUserIdAndListingId(@Param("userId") Long userId, @Param("listingId") Long listingId);

    @Query("SELECT u FROM Upvote u JOIN FETCH u.listing d WHERE u.user.id = :userId AND d.isActive = true")
    List<Upvote> findByUserIdWithActiveListings(@Param("userId") Long userId);
}
```

- [ ] **Step 3: Verify compile**

```bash
cd backend
mvn compile -q
```

Expected: BUILD SUCCESS (old DisplayRepository still exists, so no broken deps yet)

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java \
        backend/src/main/java/com/christmaslightmap/repository/UpvoteRepository.java
git commit -m "feat: add ListingRepository and update UpvoteRepository JPQL for Listing"
```

---

## Task 5: ListingService

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/service/ListingService.java`

- [ ] **Step 1: Create `ListingService.java`**

Key changes from `DisplayService`:
- Uses `ListingRepository` instead of `DisplayRepository`
- `searchListings` passes `category` + `includeExpired` params
- `buildSummary` handles nullable `displayType`
- `createListing` sets all new Listing fields
- `mapRowToSummary` reads columns 11–17 (category, start_datetime, end_datetime, price_info, cuisine_type, organizer, website_url)
- `getUpvotedListings` calls `findByUserIdWithActiveListings` + `.getListing()`

```java
package com.christmaslightmap.service;

import com.christmaslightmap.dto.response.ListingResponse;
import com.christmaslightmap.dto.response.ListingSummaryResponse;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.dto.response.TagResponse;
import com.christmaslightmap.dto.request.CreateListingRequest;
import com.christmaslightmap.model.Category;
import com.christmaslightmap.model.DisplayPhoto;
import com.christmaslightmap.model.Listing;
import com.christmaslightmap.repository.DisplayPhotoRepository;
import com.christmaslightmap.repository.ListingRepository;
import com.christmaslightmap.repository.TagRepository;
import com.christmaslightmap.repository.UpvoteRepository;
import com.christmaslightmap.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ListingService {

    private static final GeometryFactory GEOMETRY_FACTORY =
        new GeometryFactory(new PrecisionModel(), 4326);

    private final ListingRepository listingRepository;
    private final UserRepository userRepository;
    private final TagRepository tagRepository;
    private final DisplayPhotoRepository displayPhotoRepository;
    private final UpvoteRepository upvoteRepository;

    public PagedResponse<ListingSummaryResponse> searchListings(
            double lat, double lng, double radiusMiles,
            List<Long> tagIds, String category, boolean includeExpired, int page, int size) {

        double radiusMetres = radiusMiles * 1609.34;
        int offset = page * size;
        String categoryStr = (category != null && !category.isBlank()) ? category : null;

        List<Object[]> rows;
        long total;
        if (tagIds == null || tagIds.isEmpty()) {
            rows = listingRepository.searchListings(lat, lng, radiusMetres, categoryStr, includeExpired, size, offset);
            total = listingRepository.countSearchListings(lat, lng, radiusMetres, categoryStr, includeExpired);
        } else {
            rows = listingRepository.searchListingsWithTags(lat, lng, radiusMetres, categoryStr, includeExpired, tagIds, size, offset);
            total = listingRepository.countSearchListingsWithTags(lat, lng, radiusMetres, categoryStr, includeExpired, tagIds);
        }

        List<ListingSummaryResponse> summaries = rows.stream()
            .map(this::mapRowToSummary)
            .collect(Collectors.toList());

        if (!summaries.isEmpty()) {
            List<Long> ids = summaries.stream().map(ListingSummaryResponse::getId).collect(Collectors.toList());
            List<Listing> withTags = listingRepository.findByIdInWithTags(ids);
            Map<Long, List<TagResponse>> tagMap = withTags.stream().collect(Collectors.toMap(
                Listing::getId,
                d -> d.getTags().stream().map(TagResponse::from).collect(Collectors.toList())
            ));
            summaries.forEach(s -> s.setTags(tagMap.getOrDefault(s.getId(), List.of())));
        }

        return PagedResponse.<ListingSummaryResponse>builder()
            .content(summaries)
            .page(page)
            .size(size)
            .totalElements(total)
            .totalPages(total == 0 ? 0 : (int) Math.ceil((double) total / size))
            .last((long) (offset + size) >= total)
            .build();
    }

    public ListingResponse getById(Long id) {
        Listing listing = listingRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        return ListingResponse.from(listing, displayPhotoRepository.findByDisplay_Id(id));
    }

    @Transactional
    public ListingResponse createListing(Long userId, CreateListingRequest request) {
        var user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(request.getLng(), request.getLat()));
        location.setSRID(4326);

        var tags = new HashSet<>(tagRepository.findAllById(
            request.getTagIds() != null ? request.getTagIds() : List.of()));

        Listing listing = listingRepository.save(Listing.builder()
            .user(user)
            .title(request.getTitle())
            .description(request.getDescription())
            .address(request.getAddress())
            .city(request.getCity())
            .state(request.getState())
            .postcode(request.getPostcode())
            .location(location)
            .category(request.getCategory())
            .startDatetime(request.getStartDatetime())
            .endDatetime(request.getEndDatetime())
            .bestTime(request.getBestTime())
            .displayType(request.getDisplayType())
            .cuisineType(request.getCuisineType())
            .organizer(request.getOrganizer())
            .websiteUrl(request.getWebsiteUrl())
            .priceInfo(request.getPriceInfo())
            .tags(tags)
            .build());

        return ListingResponse.from(listing, List.of());
    }

    @Transactional
    public void deleteListing(Long userId, Long listingId) {
        Listing listing = listingRepository.findById(listingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        if (!listing.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
        }
        listing.setActive(false);
        listingRepository.save(listing);
    }

    public List<ListingSummaryResponse> getMyListings(Long userId) {
        List<Listing> listings = listingRepository.findByUserIdAndIsActiveTrue(userId);
        return toSummaries(listings);
    }

    public List<ListingSummaryResponse> getUpvotedListings(Long userId) {
        List<Listing> listings = upvoteRepository.findByUserIdWithActiveListings(userId).stream()
            .map(u -> u.getListing())
            .collect(Collectors.toList());
        return toSummaries(listings);
    }

    private List<ListingSummaryResponse> toSummaries(List<Listing> listings) {
        if (listings.isEmpty()) return List.of();
        List<Long> ids = listings.stream().map(Listing::getId).collect(Collectors.toList());
        Map<Long, String> primaryUrls = displayPhotoRepository.findPrimaryByDisplayIdIn(ids).stream()
            .collect(Collectors.toMap(p -> p.getDisplay().getId(), DisplayPhoto::getUrl));
        return listings.stream()
            .map(d -> buildSummary(d, primaryUrls.get(d.getId())))
            .collect(Collectors.toList());
    }

    public ListingSummaryResponse buildSummary(Listing listing, String primaryPhotoUrl) {
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
            .build();
    }

    private ListingSummaryResponse mapRowToSummary(Object[] row) {
        String categoryStr = (String) row[11];
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
            .tags(List.of())
            .build();
    }
}
```

- [ ] **Step 2: Verify compile**

```bash
cd backend
mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/service/ListingService.java
git commit -m "feat: add ListingService"
```

---

## Task 6: ListingController + SecurityConfig

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/controller/ListingController.java`
- Modify: `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java`

- [ ] **Step 1: Create `ListingController.java`**

```java
package com.christmaslightmap.controller;

import com.christmaslightmap.dto.request.CreateListingRequest;
import com.christmaslightmap.dto.request.ReportRequest;
import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.ListingResponse;
import com.christmaslightmap.dto.response.ListingSummaryResponse;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.dto.response.PhotoResponse;
import com.christmaslightmap.service.ListingService;
import com.christmaslightmap.service.PhotoService;
import com.christmaslightmap.service.ReportService;
import com.christmaslightmap.service.UpvoteService;
import org.springframework.web.multipart.MultipartFile;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/listings")
@RequiredArgsConstructor
public class ListingController {

    private final ListingService listingService;
    private final UpvoteService upvoteService;
    private final PhotoService photoService;
    private final ReportService reportService;

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<PagedResponse<ListingSummaryResponse>>> search(
        @RequestParam double lat,
        @RequestParam double lng,
        @RequestParam(defaultValue = "10") double radiusMiles,
        @RequestParam(required = false) List<Long> tags,
        @RequestParam(required = false) String category,
        @RequestParam(defaultValue = "false") boolean includeExpired,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            listingService.searchListings(lat, lng, radiusMiles, tags, category, includeExpired, page, size)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ListingResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(listingService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ListingResponse>> create(
        @RequestBody CreateListingRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(listingService.createListing(userId, request)));
    }

    @PostMapping("/{id}/upvote")
    public ResponseEntity<ApiResponse<Void>> upvote(
        @PathVariable Long id,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        if (!upvoteService.upvote(userId, id)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.success(null));
        }
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{id}/photos")
    public ResponseEntity<ApiResponse<PhotoResponse>> uploadPhoto(
        @PathVariable Long id,
        @RequestParam("file") MultipartFile file,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(photoService.uploadPhoto(id, userId, file)));
    }

    @PostMapping("/{id}/report")
    public ResponseEntity<ApiResponse<Void>> report(
        @PathVariable Long id,
        @RequestBody ReportRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        reportService.createReport(userId, id, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{id}/upvote")
    public ResponseEntity<ApiResponse<Void>> removeUpvote(
        @PathVariable Long id,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        if (!upvoteService.removeUpvote(userId, id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.success(null));
        }
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteListing(
        @PathVariable Long id,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        listingService.deleteListing(userId, id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/mine")
    public ResponseEntity<ApiResponse<List<ListingSummaryResponse>>> getMyListings(
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(listingService.getMyListings(userId)));
    }

    @GetMapping("/upvoted")
    public ResponseEntity<ApiResponse<List<ListingSummaryResponse>>> getUpvotedListings(
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(listingService.getUpvotedListings(userId)));
    }
}
```

- [ ] **Step 2: Update `SecurityConfig.java`**

Replace the `/api/v1/displays/**` rules with `/api/v1/listings/**`:

```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/oauth2/**", "/login/**", "/error").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/v1/listings/mine").authenticated()
    .requestMatchers(HttpMethod.GET, "/api/v1/listings/upvoted").authenticated()
    .requestMatchers(HttpMethod.GET, "/api/v1/listings/**").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/v1/tags").permitAll()
    .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
    .anyRequest().authenticated()
)
```

- [ ] **Step 3: Verify compile**

```bash
cd backend
mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/controller/ListingController.java \
        backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java
git commit -m "feat: add ListingController at /api/v1/listings, update SecurityConfig"
```

---

## Task 7: Admin layer — update AdminService + AdminController

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/service/AdminService.java`
- Modify: `backend/src/main/java/com/christmaslightmap/controller/AdminController.java`

- [ ] **Step 1: Rewrite `AdminService.java`**

```java
package com.christmaslightmap.service;

import com.christmaslightmap.dto.request.UpdateReportRequest;
import com.christmaslightmap.dto.response.ListingSummaryResponse;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.dto.response.ReportResponse;
import com.christmaslightmap.dto.response.TagResponse;
import com.christmaslightmap.model.DisplayPhoto;
import com.christmaslightmap.model.Listing;
import com.christmaslightmap.model.ReportStatus;
import com.christmaslightmap.repository.DisplayPhotoRepository;
import com.christmaslightmap.repository.ListingRepository;
import com.christmaslightmap.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminService {

    private final ReportRepository reportRepository;
    private final ListingRepository listingRepository;
    private final DisplayPhotoRepository displayPhotoRepository;

    public PagedResponse<ReportResponse> getReports(ReportStatus status, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<com.christmaslightmap.model.Report> reports = (status != null)
            ? reportRepository.findByStatus(status, pageable)
            : reportRepository.findAll(pageable);

        List<ReportResponse> content = reports.getContent().stream()
            .map(ReportResponse::from)
            .collect(Collectors.toList());

        return PagedResponse.<ReportResponse>builder()
            .content(content).page(page).size(size)
            .totalElements(reports.getTotalElements())
            .totalPages(reports.getTotalPages())
            .last(reports.isLast())
            .build();
    }

    @Transactional
    public ReportResponse updateReport(Long reportId, UpdateReportRequest request) {
        var report = reportRepository.findById(reportId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));
        report.setStatus(request.getStatus());
        return ReportResponse.from(reportRepository.save(report));
    }

    public PagedResponse<ListingSummaryResponse> getAllListings(Boolean active, int page, int size) {
        var pageable = PageRequest.of(page, size);
        Page<Listing> listings = (active != null)
            ? listingRepository.findByIsActiveOrderByCreatedAtDesc(active, pageable)
            : listingRepository.findAllByOrderByCreatedAtDesc(pageable);

        List<Long> ids = listings.getContent().stream().map(Listing::getId).collect(Collectors.toList());
        Map<Long, String> primaryUrls = ids.isEmpty() ? Map.of() :
            displayPhotoRepository.findPrimaryByDisplayIdIn(ids).stream()
                .collect(Collectors.toMap(p -> p.getDisplay().getId(), DisplayPhoto::getUrl));

        List<ListingSummaryResponse> content = listings.getContent().stream()
            .map(d -> ListingSummaryResponse.builder()
                .id(d.getId())
                .title(d.getTitle())
                .city(d.getCity())
                .state(d.getState())
                .lat(d.getLocation().getY())
                .lng(d.getLocation().getX())
                .upvoteCount(d.getUpvoteCount())
                .photoCount(d.getPhotoCount())
                .category(d.getCategory())
                .displayType(d.getDisplayType() != null ? d.getDisplayType().name() : null)
                .primaryPhotoUrl(primaryUrls.get(d.getId()))
                .tags(d.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
                .isActive(d.isActive())
                .startDatetime(d.getStartDatetime())
                .endDatetime(d.getEndDatetime())
                .build())
            .collect(Collectors.toList());

        return PagedResponse.<ListingSummaryResponse>builder()
            .content(content).page(page).size(size)
            .totalElements(listings.getTotalElements())
            .totalPages(listings.getTotalPages())
            .last(listings.isLast())
            .build();
    }

    @Transactional
    public ListingSummaryResponse setListingActive(Long listingId, boolean active) {
        Listing listing = listingRepository.findById(listingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        listing.setActive(active);
        Listing saved = listingRepository.save(listing);
        return ListingSummaryResponse.builder()
            .id(saved.getId())
            .title(saved.getTitle())
            .city(saved.getCity())
            .state(saved.getState())
            .lat(saved.getLocation().getY())
            .lng(saved.getLocation().getX())
            .upvoteCount(saved.getUpvoteCount())
            .photoCount(saved.getPhotoCount())
            .category(saved.getCategory())
            .displayType(saved.getDisplayType() != null ? saved.getDisplayType().name() : null)
            .isActive(saved.isActive())
            .tags(saved.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
            .build();
    }

    @Transactional
    public void adminDeleteListing(Long listingId) {
        Listing listing = listingRepository.findById(listingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        listingRepository.delete(listing);
    }
}
```

- [ ] **Step 2: Rewrite `AdminController.java`**

```java
package com.christmaslightmap.controller;

import com.christmaslightmap.dto.request.AdminDisplayRequest;
import com.christmaslightmap.dto.request.UpdateReportRequest;
import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.ListingSummaryResponse;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.dto.response.ReportResponse;
import com.christmaslightmap.model.ReportStatus;
import com.christmaslightmap.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/reports")
    public ResponseEntity<ApiResponse<PagedResponse<ReportResponse>>> getReports(
        @RequestParam(required = false) ReportStatus status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getReports(status, page, size)));
    }

    @PatchMapping("/reports/{id}")
    public ResponseEntity<ApiResponse<ReportResponse>> updateReport(
        @PathVariable Long id,
        @RequestBody UpdateReportRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(adminService.updateReport(id, request)));
    }

    @GetMapping("/listings")
    public ResponseEntity<ApiResponse<PagedResponse<ListingSummaryResponse>>> getAllListings(
        @RequestParam(required = false) Boolean active,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getAllListings(active, page, size)));
    }

    @PatchMapping("/listings/{id}/status")
    public ResponseEntity<ApiResponse<ListingSummaryResponse>> setListingActive(
        @PathVariable Long id,
        @RequestBody AdminDisplayRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(adminService.setListingActive(id, request.isActive())));
    }

    @DeleteMapping("/listings/{id}")
    public ResponseEntity<ApiResponse<Void>> adminDeleteListing(@PathVariable Long id) {
        adminService.adminDeleteListing(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
```

- [ ] **Step 3: Verify compile**

```bash
cd backend
mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/service/AdminService.java \
        backend/src/main/java/com/christmaslightmap/controller/AdminController.java
git commit -m "feat: update AdminService and AdminController to use Listing"
```

---

## Task 8: Atomic switchover — update models + services, delete old code

This task updates `Upvote`, `Report`, `DisplayPhoto` to reference `Listing`, then updates `PhotoService`, `UpvoteService`, `ReportService` to use `ListingRepository`, and deletes all `Display*` classes.

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/model/Upvote.java`
- Modify: `backend/src/main/java/com/christmaslightmap/model/Report.java`
- Modify: `backend/src/main/java/com/christmaslightmap/model/DisplayPhoto.java`
- Modify: `backend/src/main/java/com/christmaslightmap/service/PhotoService.java`
- Modify: `backend/src/main/java/com/christmaslightmap/service/UpvoteService.java`
- Modify: `backend/src/main/java/com/christmaslightmap/service/ReportService.java`
- Delete: `Display.java`, `DisplayRepository.java`, `DisplayService.java`, `DisplayController.java`, `CreateDisplayRequest.java`, `DisplaySummaryResponse.java`, `DisplayResponse.java`

- [ ] **Step 1: Update `Upvote.java`** — change `Display display` to `Listing listing`, keep `@JoinColumn(name = "display_id")`

```java
package com.christmaslightmap.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "upvotes")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Upvote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "display_id", nullable = false)
    private Listing listing;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
```

- [ ] **Step 2: Update `Report.java`** — change `Display display` to `Listing listing`, keep `@JoinColumn(name = "display_id")`

```java
package com.christmaslightmap.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "reports")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "display_id", nullable = false)
    private Listing listing;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ReportReason reason;

    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ReportStatus status = ReportStatus.OPEN;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
```

- [ ] **Step 3: Update `DisplayPhoto.java`** — change `Display display` to `Listing display` (keep field name `display` — `DisplayPhotoRepository` uses `findByDisplay_Id` which matches this field name)

```java
package com.christmaslightmap.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "display_photos")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DisplayPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "display_id", nullable = false)
    private Listing display;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String url;

    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private boolean isPrimary = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
```

- [ ] **Step 4: Update `PhotoService.java`** — replace `DisplayRepository displayRepository` with `ListingRepository listingRepository`

Open the file. In the service's `uploadPhoto` method, the display lookup uses `displayRepository.findById(displayId)`. Change:
- Import: replace `import com.christmaslightmap.repository.DisplayRepository;` with `import com.christmaslightmap.repository.ListingRepository;`
- Field: replace `private final DisplayRepository displayRepository;` with `private final ListingRepository listingRepository;`
- In `uploadPhoto`: replace `displayRepository.findById(displayId)` with `listingRepository.findById(displayId)`
- In `uploadPhoto`: change `DisplayPhoto.builder()...display(display)...` — the `display` variable is now a `Listing`, and the `DisplayPhoto.display` field is now `Listing display`, so no change needed there other than the type.

- [ ] **Step 5: Update `UpvoteService.java`** — replace `DisplayRepository` with `ListingRepository`, update method calls

Open the file. Replace `DisplayRepository displayRepository` with `ListingRepository listingRepository`. Replace `displayRepository.findById(id)` with `listingRepository.findById(id)`. Replace `upvoteRepository.countByUserAndDisplay(...)` with `upvoteRepository.countByUserAndListing(...)`. Replace `upvoteRepository.deleteByUserIdAndDisplayId(...)` with `upvoteRepository.deleteByUserIdAndListingId(...)`. Build the `Upvote` with `.listing(listing)` instead of `.display(display)`.

- [ ] **Step 6: Update `ReportService.java`** — replace `DisplayRepository` with `ListingRepository`, update object graph

Open the file. Replace `DisplayRepository displayRepository` with `ListingRepository listingRepository`. Replace `displayRepository.findById(id)` with `listingRepository.findById(id)`. Update `Report.builder()...listing(listing)...` instead of `display(display)`.

- [ ] **Step 7: Update `ReportResponse.java`** — `ReportResponse.from(report)` calls `report.getDisplay()` which is now `report.getListing()`

Open `backend/src/main/java/com/christmaslightmap/dto/response/ReportResponse.java`. Change `report.getDisplay().getId()` → `report.getListing().getId()` and `report.getDisplay().getTitle()` → `report.getListing().getTitle()`.

- [ ] **Step 8: Delete old files**

```bash
cd backend/src/main/java/com/christmaslightmap
rm model/Display.java \
   repository/DisplayRepository.java \
   service/DisplayService.java \
   controller/DisplayController.java \
   dto/request/CreateDisplayRequest.java \
   dto/response/DisplaySummaryResponse.java \
   dto/response/DisplayResponse.java
```

- [ ] **Step 9: Verify full compile**

```bash
cd backend
mvn compile -q
```

Expected: BUILD SUCCESS with no references to the deleted classes.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: atomic switchover — Upvote/Report/DisplayPhoto now reference Listing; delete Display* classes"
```

---

## Task 9: Update integration tests

**Files:**
- Create: `backend/src/test/java/com/christmaslightmap/ListingSearchTest.java`
- Delete: `backend/src/test/java/com/christmaslightmap/DisplaySearchTest.java`

- [ ] **Step 1: Write `ListingSearchTest.java`**

```java
package com.christmaslightmap;

import com.christmaslightmap.model.Category;
import com.christmaslightmap.model.Listing;
import com.christmaslightmap.model.User;
import com.christmaslightmap.model.UserRole;
import com.christmaslightmap.repository.ListingRepository;
import com.christmaslightmap.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class ListingSearchTest extends BaseIntegrationTest {

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

    private Listing.ListingBuilder baseListing(User user, String title, Point location) {
        return Listing.builder()
            .user(user).title(title).location(location)
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().minusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(30));
    }

    @Test
    void search_withinRadius_returnsOnlyNearbyListings() {
        User user = userRepository.save(User.builder()
            .provider("google").providerId("g1").email("u@test.com")
            .name("User").role(UserRole.USER).build());

        listingRepository.save(baseListing(user, "Seattle Listing 1", point(-122.3321, 47.6062)).build());
        listingRepository.save(baseListing(user, "Seattle Listing 2", point(-122.30, 47.61)).build());
        // Portland ~174 miles away — outside 10-mile radius
        listingRepository.save(baseListing(user, "Portland Listing", point(-122.6750, 45.5051)).build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/listings/search?lat=47.6062&lng=-122.3321&radiusMiles=10", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Seattle Listing 1");
        assertThat(response.getBody()).contains("Seattle Listing 2");
        assertThat(response.getBody()).doesNotContain("Portland Listing");
    }

    @Test
    void search_emptyArea_returnsEmptyPage() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/listings/search?lat=0.0&lng=0.0&radiusMiles=1", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"totalElements\":0");
    }

    @Test
    void search_expiredListing_notReturnedByDefault() {
        User user = userRepository.save(User.builder()
            .provider("google").providerId("g2").email("u2@test.com")
            .name("User2").role(UserRole.USER).build());

        listingRepository.save(Listing.builder()
            .user(user).title("Expired Yard Sale").location(point(-122.3321, 47.6062))
            .category(Category.YARD_SALE)
            .startDatetime(LocalDateTime.now().minusDays(10))
            .endDatetime(LocalDateTime.now().minusDays(1))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/listings/search?lat=47.6062&lng=-122.3321&radiusMiles=10", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain("Expired Yard Sale");
    }

    @Test
    void search_categoryFilter_returnsOnlyMatchingCategory() {
        User user = userRepository.save(User.builder()
            .provider("google").providerId("g3").email("u3@test.com")
            .name("User3").role(UserRole.USER).build());

        listingRepository.save(baseListing(user, "Xmas Lights", point(-122.3321, 47.6062)).build());
        listingRepository.save(baseListing(user, "Yard Sale", point(-122.3321, 47.6062))
            .category(Category.YARD_SALE).build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/listings/search?lat=47.6062&lng=-122.3321&radiusMiles=10&category=YARD_SALE", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Yard Sale");
        assertThat(response.getBody()).doesNotContain("Xmas Lights");
    }
}
```

- [ ] **Step 2: Delete old test file**

```bash
rm backend/src/test/java/com/christmaslightmap/DisplaySearchTest.java
```

- [ ] **Step 3: Run tests**

```bash
cd backend
mvn test -pl . -Dtest=ListingSearchTest -q
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/java/com/christmaslightmap/ListingSearchTest.java
git rm backend/src/test/java/com/christmaslightmap/DisplaySearchTest.java
git commit -m "test: replace DisplaySearchTest with ListingSearchTest; add expiry and category filter tests"
```

---

## Task 10: Frontend — `listing.model.ts`

**Files:**
- Create: `frontend/src/app/models/listing.model.ts`

- [ ] **Step 1: Create `listing.model.ts`**

```typescript
export type Category =
  | 'CHRISTMAS_LIGHTS'
  | 'YARD_SALE'
  | 'ESTATE_SALE'
  | 'POPUP_MARKET'
  | 'FOOD_TRUCK';

export const CATEGORY_LABELS: Record<Category, string> = {
  CHRISTMAS_LIGHTS: 'Christmas Lights',
  YARD_SALE:        'Yard / Garage Sale',
  ESTATE_SALE:      'Estate Sale',
  POPUP_MARKET:     'Pop-up Market',
  FOOD_TRUCK:       'Food Truck',
};

export const CATEGORY_COLORS: Record<Category, { bg: string; text: string; dot: string; marker: string }> = {
  CHRISTMAS_LIGHTS: { bg: '#dcfce7', text: '#166534', dot: '#22c55e', marker: '#22c55e' },
  YARD_SALE:        { bg: '#fef9c3', text: '#713f12', dot: '#eab308', marker: '#eab308' },
  ESTATE_SALE:      { bg: '#fce7f3', text: '#9d174d', dot: '#ec4899', marker: '#ec4899' },
  POPUP_MARKET:     { bg: '#ede9fe', text: '#4c1d95', dot: '#8b5cf6', marker: '#8b5cf6' },
  FOOD_TRUCK:       { bg: '#ffedd5', text: '#9a3412', dot: '#f97316', marker: '#f97316' },
};

export interface Tag {
  id: number;
  name: string;
}

export interface Photo {
  id: number;
  url: string;
  isPrimary: boolean;
}

export type DisplayType = 'DRIVE_BY' | 'WALK_THROUGH' | 'BOTH';

export const TYPE_LABELS: Record<string, string> = {
  DRIVE_BY:     'Drive-by',
  WALK_THROUGH: 'Walk-through',
  BOTH:         'Combined',
};

/** Returned by GET /listings/search, /listings/mine, /listings/upvoted */
export interface ListingSummary {
  id: number;
  title: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  upvoteCount: number;
  photoCount: number;
  category: Category;
  displayType: string | null;
  primaryPhotoUrl: string | null;
  tags: Tag[];
  isActive: boolean;
  startDatetime: string;
  endDatetime: string;
  priceInfo: string | null;
  cuisineType: string | null;
  organizer: string | null;
  websiteUrl: string | null;
}

/** Returned by GET /listings/:id */
export interface Listing extends ListingSummary {
  submittedBy: number;
  description: string;
  address: string;
  postcode: string;
  bestTime: string | null;
  createdAt: string;
  photos: Photo[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
}

export interface Report {
  id: number;
  listingId: number;
  listingTitle: string;
  reporterId: number;
  reporterName: string;
  reason: string;
  notes: string;
  status: string;
  createdAt: string;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface SearchParams {
  lat: number;
  lng: number;
  radiusMiles?: number;
  tags?: number[];
  category?: Category | '';
  page?: number;
  size?: number;
}

export interface CreateListingRequest {
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
  // Christmas Lights only
  bestTime: string;
  displayType: string;
  tagIds: number[];
  // Food Truck only
  cuisineType: string;
  // Estate Sale only
  organizer: string;
  // Christmas Lights + Food Truck only
  websiteUrl: string;
}

export const TAG_STYLES: Record<string, { bg: string; text: string }> = {
  'animated':        { bg: '#e0e7ff', text: '#3730a3' },
  'music-synced':    { bg: '#fce7f3', text: '#9d174d' },
  'walk-through':    { bg: '#d1fae5', text: '#065f46' },
  'inflatables':     { bg: '#fff7ed', text: '#9a3412' },
  'projections':     { bg: '#f3e8ff', text: '#6b21a8' },
  'rooftop':         { bg: '#e0f2fe', text: '#075985' },
  'family-friendly': { bg: '#dcfce7', text: '#166534' },
  'pet-friendly':    { bg: '#fef9c3', text: '#713f12' },
  'charity':         { bg: '#ffe4e6', text: '#9f1239' },
};

export const ALL_TAGS = [
  'animated', 'music-synced', 'walk-through', 'inflatables',
  'projections', 'rooftop', 'family-friendly', 'pet-friendly', 'charity',
];

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
}

export function isExpired(listing: ListingSummary): boolean {
  return new Date(listing.endDatetime) < new Date();
}

export function isUpcoming(listing: ListingSummary): boolean {
  return new Date(listing.startDatetime) > new Date();
}

export function formatDateRange(start: string, end: string): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const s = new Date(start), e = new Date(end);
  if (s.toDateString() === e.toDateString()) return fmt(s);
  return `${fmt(s)} – ${fmt(e)}`;
}
```

- [ ] **Step 2: Verify compile**

```bash
cd frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors on the new file.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/models/listing.model.ts
git commit -m "feat: add listing.model.ts with Category, CATEGORY_COLORS, ListingSummary, Listing types"
```

---

## Task 11: Frontend — `listing-api.service.ts`

**Files:**
- Create: `frontend/src/app/services/listing-api.service.ts`

- [ ] **Step 1: Create `listing-api.service.ts`**

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Listing, ListingSummary, Tag, Report,
  PagedResponse, SearchParams, CreateListingRequest
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

  getMyListings(): Observable<ListingSummary[]> {
    return this.http.get<ApiResponse<ListingSummary[]>>(`${this.base}/listings/mine`, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  getUpvotedListings(): Observable<ListingSummary[]> {
    return this.http.get<ApiResponse<ListingSummary[]>>(`${this.base}/listings/upvoted`, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  getReports(status?: string, page = 0, size = 20): Observable<PagedResponse<Report>> {
    let p = new HttpParams().set('page', page).set('size', size);
    if (status && status !== 'ALL') p = p.set('status', status);
    return this.http.get<ApiResponse<PagedResponse<Report>>>(`${this.base}/admin/reports`, { params: p, withCredentials: true })
      .pipe(map(r => r.data));
  }

  updateReport(reportId: number, status: string): Observable<Report> {
    return this.http.patch<ApiResponse<Report>>(`${this.base}/admin/reports/${reportId}`, { status }, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  deleteListing(listingId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/listings/${listingId}`, { withCredentials: true });
  }

  adminGetListings(active?: boolean, page = 0, size = 50): Observable<PagedResponse<ListingSummary>> {
    let p = new HttpParams().set('page', page).set('size', size);
    if (active !== undefined) p = p.set('active', active);
    return this.http.get<ApiResponse<PagedResponse<ListingSummary>>>(`${this.base}/admin/listings`, { params: p, withCredentials: true })
      .pipe(map(r => r.data));
  }

  adminSetListingActive(listingId: number, active: boolean): Observable<ListingSummary> {
    return this.http.patch<ApiResponse<ListingSummary>>(`${this.base}/admin/listings/${listingId}/status`, { active }, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  adminDeleteListing(listingId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/listings/${listingId}`, { withCredentials: true });
  }
}
```

- [ ] **Step 2: Verify compile**

```bash
cd frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors on the new service.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/services/listing-api.service.ts
git commit -m "feat: add ListingApiService pointing to /api/v1/listings"
```

---

## Task 12: Update `app.component.ts` imports

**Files:**
- Modify: `frontend/src/app/app.component.ts`

`app.component.ts` uses `DisplaySummary` and `DisplayApiService` (implicitly through sub-components). The sub-components get their own updates in later tasks, but `app.component.ts` passes the `selectedDisplay` signal around.

- [ ] **Step 1: Update imports and types in `app.component.ts`**

Change:
```typescript
import { DisplaySummary } from './models/display.model';
```
To:
```typescript
import { ListingSummary } from './models/listing.model';
```

Change the signal type from `signal<DisplaySummary | null>` to `signal<ListingSummary | null>`:
```typescript
selectedDisplay = signal<ListingSummary | null>(null);
```

Change `openDetail(display: DisplaySummary)` to:
```typescript
openDetail(display: ListingSummary) {
  this.selectedDisplay.set(display);
}
```

Update the import of `UpvoteService` if it uses the old display API — check `upvoteService.toggle($event)` in the template. If `UpvoteService` now uses `ListingApiService` internally, the API is the same (just an id number).

- [ ] **Step 2: Verify compile**

```bash
cd frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only in the not-yet-updated page components, not in app.component.ts itself.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/app.component.ts
git commit -m "feat: update app.component.ts to use ListingSummary"
```

---

## Task 13: Update map component

**Files:**
- Modify: `frontend/src/app/pages/map/map.component.ts`

Key changes:
- Import `ListingSummary`, `CATEGORY_COLORS`, `CATEGORY_LABELS`, `Category` from `listing.model`; import `ListingApiService`
- Replace `DisplaySummary` type with `ListingSummary`
- Replace `DisplayApiService` with `ListingApiService`
- Replace type filter chips with category filter chips
- Use `CATEGORY_COLORS[listing.category].marker` for map marker colors
- Update listing cards to show category badge + date range + price
- Pass `category` instead of `displayType` in search params

- [ ] **Step 1: Update imports at the top of `map.component.ts`**

```typescript
import { ListingSummary, CATEGORY_COLORS, CATEGORY_LABELS, Category, formatDateRange, isUpcoming } from '../../models/listing.model';
import { ListingApiService } from '../../services/listing-api.service';
```

Remove imports of `DisplaySummary`, `TYPE_COLORS`, `TYPE_LABELS`, `DisplayApiService`.

- [ ] **Step 2: Update class fields and injected service**

```typescript
private listingApi = inject(ListingApiService);
listings = signal<ListingSummary[]>([]);
selectedCategory = signal<Category | ''>('');
categoryOptions: Array<{ id: Category | ''; label: string }> = [
  { id: '', label: 'All' },
  { id: 'CHRISTMAS_LIGHTS', label: 'Christmas Lights' },
  { id: 'YARD_SALE',        label: 'Yard Sales' },
  { id: 'ESTATE_SALE',      label: 'Estate Sales' },
  { id: 'POPUP_MARKET',     label: 'Pop-up Markets' },
  { id: 'FOOD_TRUCK',       label: 'Food Trucks' },
];
categoryColors = CATEGORY_COLORS;
categoryLabels = CATEGORY_LABELS;
formatDateRange = formatDateRange;
isUpcoming = isUpcoming;
```

- [ ] **Step 3: Update `searchNearby()` to use `listingApi.search` with `category` param**

```typescript
searchNearby(lat: number, lng: number) {
  const category = this.selectedCategory();
  this.listingApi.search({
    lat, lng,
    radiusMiles: 25,
    category: category || undefined,
  }).subscribe(r => {
    this.listings.set(r.content);
    this.renderMarkers(r.content);
  });
}
```

- [ ] **Step 4: Update `renderMarkers()` to use category colors**

In the existing marker rendering code, replace the `TYPE_COLORS[display.displayType]` color lookup with:
```typescript
const color = CATEGORY_COLORS[listing.category]?.marker ?? '#64748b';
```
Use this color for the SVG marker fill.

- [ ] **Step 5: Update filter chip template**

Replace the existing type filter chip buttons with category chips. In the handle div template, replace:
```html
<!-- OLD: type filter chips -->
<button *ngFor="let t of typeOptions" ...>{{t.label}}</button>
```
With:
```html
<button *ngFor="let cat of categoryOptions"
        (click)="selectedCategory.set(cat.id); searchNearby(mapCenter().lat, mapCenter().lng)"
        [style.background]="selectedCategory() === cat.id ? 'var(--accent)' : '#f1f5f9'"
        [style.color]="selectedCategory() === cat.id ? 'white' : '#374151'"
        style="white-space:nowrap;border:none;padding:5px 12px;border-radius:20px;
               font-size:12.5px;font-weight:600;cursor:pointer;flex-shrink:0">
  {{cat.label}}
</button>
```

- [ ] **Step 6: Update listing card template to show category badge + date range**

In the listing card / bottom sheet list item template, add:
```html
<!-- Category badge -->
<span [style.background]="categoryColors[listing.category]?.bg"
      [style.color]="categoryColors[listing.category]?.text"
      style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:99px;display:inline-block;margin-bottom:4px">
  {{categoryLabels[listing.category]}}
</span>
<!-- Date range -->
<div style="font-size:11.5px;color:#64748b;margin-top:2px">
  {{formatDateRange(listing.startDatetime, listing.endDatetime)}}
  <span *ngIf="isUpcoming(listing)"
        style="margin-left:4px;background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:4px;font-size:10px">
    Upcoming
  </span>
</div>
<!-- Price -->
<div *ngIf="listing.priceInfo"
     style="font-size:11.5px;color:#64748b;margin-top:1px">{{listing.priceInfo}}</div>
```

- [ ] **Step 7: Verify no TypeScript errors**

```bash
cd frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors related to map.component.ts (other components may still show errors).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/pages/map/map.component.ts
git commit -m "feat: update map component — category filter chips, category-colored markers, date range in cards"
```

---

## Task 14: Update submit component

**Files:**
- Modify: `frontend/src/app/pages/submit/submit.component.ts`

Key changes:
- Import `CreateListingRequest`, `CATEGORY_LABELS`, `Category` from `listing.model`; use `ListingApiService`
- Add `category` as first form field (category picker step or field within step 2)
- Show/hide fields based on selected category
- Add `startDatetime` and `endDatetime` pickers (datetime-local inputs)
- Add `priceInfo`, `cuisineType`, `organizer`, `websiteUrl` fields
- Submit changed header from "Add a Display" to "Add a Listing"

- [ ] **Step 1: Update imports**

```typescript
import { CATEGORY_LABELS, Category, Tag } from '../../models/listing.model';
import { ListingApiService } from '../../services/listing-api.service';
```

Remove old `DisplayApiService`, `ALL_TAGS`, `TYPE_LABELS` imports.

- [ ] **Step 2: Update form object**

Replace the existing form object with:
```typescript
form = {
  category: '' as Category | '',
  address: '', city: '', state: '', postcode: '',
  lat: 0, lng: 0,
  title: '', description: '',
  startDatetime: '', endDatetime: '',
  priceInfo: '',
  // Christmas Lights only
  displayType: 'DRIVE_BY', bestTime: '', tagIds: [] as number[],
  // Food Truck only
  cuisineType: '',
  // Estate Sale only
  organizer: '',
  // Christmas Lights + Food Truck only
  websiteUrl: '',
};

categoryOptions: Array<{ id: Category; label: string }> = [
  { id: 'CHRISTMAS_LIGHTS', label: '🎄 Christmas Lights' },
  { id: 'YARD_SALE',        label: '🏷️ Yard / Garage Sale' },
  { id: 'ESTATE_SALE',      label: '🏠 Estate Sale' },
  { id: 'POPUP_MARKET',     label: '🛍️ Pop-up Market' },
  { id: 'FOOD_TRUCK',       label: '🚚 Food Truck' },
];
```

- [ ] **Step 3: Add category-field-visibility helpers**

```typescript
get isLights() { return this.form.category === 'CHRISTMAS_LIGHTS'; }
get isFoodTruck() { return this.form.category === 'FOOD_TRUCK'; }
get isEstateSale() { return this.form.category === 'ESTATE_SALE'; }
get showWebsite() { return this.isLights || this.isFoodTruck; }
```

- [ ] **Step 4: Add category picker to Step 2 template**

At the top of the details step (Step 2), add before the title input:

```html
<div>
  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:8px">
    Category *
  </label>
  <div style="display:flex;flex-direction:column;gap:8px">
    <button *ngFor="let cat of categoryOptions"
            (click)="form.category = cat.id"
            [style.border]="form.category === cat.id ? '2px solid var(--accent)' : '2px solid #e2e8f0'"
            [style.background]="form.category === cat.id ? 'var(--accent-bg)' : 'white'"
            style="padding:10px 14px;border-radius:10px;text-align:left;cursor:pointer;
                   font-size:13.5px;font-weight:500;color:#0f172a;transition:all 0.1s">
      {{cat.label}}
    </button>
  </div>
</div>
```

- [ ] **Step 5: Add datetime pickers + conditional fields to Step 2 template**

After the description field:

```html
<!-- Start / End dates — all categories -->
<div style="display:flex;gap:12px">
  <div style="flex:1">
    <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Start *</label>
    <input type="datetime-local" [(ngModel)]="form.startDatetime"
           style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                  font-size:13px;color:#0f172a;background:white;box-sizing:border-box"/>
  </div>
  <div style="flex:1">
    <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">End *</label>
    <input type="datetime-local" [(ngModel)]="form.endDatetime"
           style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                  font-size:13px;color:#0f172a;background:white;box-sizing:border-box"/>
  </div>
</div>

<!-- Price info — all categories -->
<div>
  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">
    Price (optional)
  </label>
  <input [(ngModel)]="form.priceInfo" placeholder='e.g. Free, $8 admission'
         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                font-size:14px;color:#0f172a;background:white;box-sizing:border-box"/>
</div>

<!-- Christmas Lights: display type, best time, tags -->
<ng-container *ngIf="isLights">
  <!-- existing display type, best time, tags fields -->
</ng-container>

<!-- Food Truck: cuisine type -->
<div *ngIf="isFoodTruck">
  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Cuisine Type</label>
  <input [(ngModel)]="form.cuisineType" placeholder="e.g. Mexican, BBQ, Thai"
         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                font-size:14px;color:#0f172a;background:white;box-sizing:border-box"/>
</div>

<!-- Estate Sale: organizer -->
<div *ngIf="isEstateSale">
  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Organizer</label>
  <input [(ngModel)]="form.organizer" placeholder="e.g. Estate Professionals Inc."
         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                font-size:14px;color:#0f172a;background:white;box-sizing:border-box"/>
</div>

<!-- Website — Christmas Lights + Food Truck -->
<div *ngIf="showWebsite">
  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Website (optional)</label>
  <input [(ngModel)]="form.websiteUrl" placeholder="https://..."
         style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                font-size:14px;color:#0f172a;background:white;box-sizing:border-box"/>
</div>
```

- [ ] **Step 6: Update `submit()` method to call `listingApi.create()`**

```typescript
submit() {
  this.listingApi.create({
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
  }).subscribe({
    next: listing => {
      this.createdListingId.set(listing.id);
      this.step.set('photo');
    },
    error: () => { /* show error */ }
  });
}
```

- [ ] **Step 7: Update success screen text**

Change "Display Submitted!" to "Listing Submitted!" and update description text to "Your listing is now live on the community board!"

- [ ] **Step 8: Verify compile**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "submit.component" | head -20
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/pages/submit/submit.component.ts
git commit -m "feat: update submit component — category picker, datetime fields, category-conditional fields"
```

---

## Task 15: Update display-detail modal

**Files:**
- Modify: `frontend/src/app/shared/display-detail/display-detail.component.ts`

Key changes:
- Import `Listing`, `ListingSummary`, `CATEGORY_COLORS`, `CATEGORY_LABELS`, `formatDateRange` from `listing.model`
- Use `ListingApiService` instead of `DisplayApiService`
- Replace `@Input() summary: DisplaySummary` with `@Input() summary: ListingSummary`
- Show category badge + date range at top (below title)
- Show cuisine type, organizer, website link when present

- [ ] **Step 1: Update imports**

```typescript
import { Listing, ListingSummary, CATEGORY_COLORS, CATEGORY_LABELS, formatDateRange } from '../../models/listing.model';
import { ListingApiService } from '../../services/listing-api.service';
```

- [ ] **Step 2: Update `@Input()` type and service injection**

```typescript
@Input() summary!: ListingSummary;
private listingApi = inject(ListingApiService);
fullDisplay = signal<Listing | null>(null);
categoryColors = CATEGORY_COLORS;
categoryLabels = CATEGORY_LABELS;
formatDateRange = formatDateRange;
```

In `ngOnInit`, change `displayApi.getById(this.summary.id)` to `listingApi.getById(this.summary.id)`.

- [ ] **Step 3: Update template — replace type badge with category badge + date range**

Replace the existing `<span>` type badge in the content header area with:

```html
<!-- Category badge + date range -->
<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
  <span [style.background]="categoryColors[fullDisplay()!.category]?.bg"
        [style.color]="categoryColors[fullDisplay()!.category]?.text"
        style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px">
    {{categoryLabels[fullDisplay()!.category]}}
  </span>
  <span style="font-size:12px;color:#64748b">
    {{formatDateRange(fullDisplay()!.startDatetime, fullDisplay()!.endDatetime)}}
  </span>
</div>
```

- [ ] **Step 4: Add category-specific fields to template**

After the description section, add:

```html
<!-- Cuisine type — Food Truck -->
<div *ngIf="fullDisplay()!.cuisineType"
     style="font-size:13.5px;color:#374151">
  🍽️ {{fullDisplay()!.cuisineType}}
</div>

<!-- Organizer — Estate Sale -->
<div *ngIf="fullDisplay()!.organizer"
     style="font-size:13.5px;color:#374151">
  🏢 {{fullDisplay()!.organizer}}
</div>

<!-- Price info -->
<div *ngIf="fullDisplay()!.priceInfo"
     style="font-size:13.5px;color:#374151">
  💰 {{fullDisplay()!.priceInfo}}
</div>

<!-- Best time — Christmas Lights -->
<div *ngIf="fullDisplay()!.bestTime"
     style="font-size:13.5px;color:#374151">
  🕐 {{fullDisplay()!.bestTime}}
</div>

<!-- Website -->
<div *ngIf="fullDisplay()!.websiteUrl">
  <a [href]="fullDisplay()!.websiteUrl" target="_blank" rel="noopener"
     style="font-size:13.5px;color:var(--accent);text-decoration:none;font-weight:600">
    🌐 Visit website
  </a>
</div>
```

- [ ] **Step 5: Update report call**

Change `displayApi.report(...)` to `listingApi.report(...)`.

- [ ] **Step 6: Verify compile**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "display-detail" | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/shared/display-detail/display-detail.component.ts
git commit -m "feat: update display-detail modal — category badge, date range, category-specific fields"
```

---

## Task 16: Update profile component

**Files:**
- Modify: `frontend/src/app/pages/profile/profile.component.ts`

Key changes:
- Import `ListingSummary`, `CATEGORY_COLORS`, `CATEGORY_LABELS`, `isExpired`, `formatDateRange` from `listing.model`
- Use `ListingApiService`
- Replace `DisplaySummary` with `ListingSummary`
- Show category badge on each listing card
- Show expired listings in muted style with "Ended" label

- [ ] **Step 1: Update imports and service**

```typescript
import { ListingSummary, CATEGORY_COLORS, CATEGORY_LABELS, isExpired, formatDateRange } from '../../models/listing.model';
import { ListingApiService } from '../../services/listing-api.service';
```

Replace `DisplayApiService` injection with `ListingApiService`. Replace `getMyDisplays()` call with `getMyListings()`. Replace `getUpvotedDisplays()` with `getUpvotedListings()`.

- [ ] **Step 2: Add helpers to class**

```typescript
categoryColors = CATEGORY_COLORS;
categoryLabels = CATEGORY_LABELS;
isExpired = isExpired;
formatDateRange = formatDateRange;
```

- [ ] **Step 3: Update listing card template**

In the listing card template (for both "My Listings" and "Upvoted" tabs), add:

```html
<!-- Wrap card with muted style for expired -->
<div [style.opacity]="isExpired(listing) ? '0.55' : '1'"
     style="...existing card styles...">
  <!-- Category badge -->
  <span [style.background]="categoryColors[listing.category]?.bg"
        [style.color]="categoryColors[listing.category]?.text"
        style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;display:inline-block;margin-bottom:4px">
    {{categoryLabels[listing.category]}}
  </span>
  <span *ngIf="isExpired(listing)"
        style="margin-left:4px;font-size:10px;color:#ef4444;font-weight:700">Ended</span>
  <!-- existing title, city, upvote count etc -->
  <div style="font-size:11.5px;color:#94a3b8;margin-top:2px">
    {{formatDateRange(listing.startDatetime, listing.endDatetime)}}
  </div>
</div>
```

- [ ] **Step 4: Verify compile**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "profile.component" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/pages/profile/profile.component.ts
git commit -m "feat: update profile component — category badges, expired listings shown muted"
```

---

## Task 17: Update admin component

**Files:**
- Modify: `frontend/src/app/pages/admin/admin.component.ts`

Key changes:
- Import `ListingSummary`, `CATEGORY_LABELS` from `listing.model`; use `ListingApiService`
- Replace `DisplaySummary` with `ListingSummary`
- Add category column to listings table
- Call `adminGetListings()` instead of `adminGetDisplays()`

- [ ] **Step 1: Update imports and service calls**

```typescript
import { ListingSummary, CATEGORY_LABELS } from '../../models/listing.model';
import { ListingApiService } from '../../services/listing-api.service';
```

Replace `DisplayApiService` with `ListingApiService`. Replace `adminGetDisplays()` with `adminGetListings()`. Replace `adminSetDisplayActive()` with `adminSetListingActive()`. Replace `adminDeleteDisplay()` with `adminDeleteListing()`.

- [ ] **Step 2: Add category column to table template**

In the listings table, add a category column between title and city:

```html
<th style="...">Category</th>
...
<td>
  <span style="font-size:11px;font-weight:600;color:#64748b">
    {{categoryLabels[listing.category]}}
  </span>
</td>
```

Add `categoryLabels = CATEGORY_LABELS;` to the class.

- [ ] **Step 3: Verify compile**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "admin.component" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/pages/admin/admin.component.ts
git commit -m "feat: update admin component — use ListingApiService, add category column"
```

---

## Task 18: Final cleanup — verify build and delete old display model files

**Files:**
- Verify `display.model.ts` and `display-api.service.ts` have no remaining imports elsewhere

- [ ] **Step 1: Check for remaining references to old files**

```bash
cd frontend
grep -r "display.model\|display-api.service\|DisplayApiService\|DisplaySummary\b" src/app --include="*.ts" -l
```

Expected: output is empty (no more references to old model/service).

- [ ] **Step 2: If any files still reference old model, update them now**

For each file returned by the grep above, open it and replace:
- `import { ... } from '../../models/display.model'` → `from '../../models/listing.model'`
- `import { DisplayApiService } from '../../services/display-api.service'` → `ListingApiService` from `listing-api.service`
- `DisplaySummary` → `ListingSummary`

- [ ] **Step 3: Run full type check**

```bash
cd frontend
npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 4: Run full backend test suite**

```bash
cd backend
mvn test -q
```

Expected: all tests pass (including `ListingSearchTest`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: full community board feature complete — listings replace displays across stack"
```

---

## Task 19: Rebrand text

**Files:**
- Modify: `frontend/src/app/shared/navbar/navbar.component.ts`
- Modify: `frontend/src/app/pages/submit/submit.component.ts` (success screen text)

The app will be rebranded from "Holiday Light Planner". The actual brand name is TBD — use a placeholder until the user decides. For now, update text that is clearly "Holiday Light Planner" to use a neutral "Community Board" placeholder.

- [ ] **Step 1: Update navbar wordmark**

In `navbar.component.ts`, change the stacked logo text from:
```html
<span style="font-weight:800;font-size:14px;color:#0f172a;letter-spacing:-0.4px">Holiday Light</span>
<span style="font-weight:600;font-size:9px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase">Planner</span>
```
To (placeholder — update to final brand name when decided):
```html
<span style="font-weight:800;font-size:14px;color:#0f172a;letter-spacing:-0.4px">Community</span>
<span style="font-weight:600;font-size:9px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase">Board</span>
```

- [ ] **Step 2: Update submit form header**

In `submit.component.ts`, change:
- `"Add a Display"` → `"Add a Listing"`
- `"Share a holiday light display with the community"` → `"Share something with your community"`
- `"Display Submitted!"` → `"Listing Submitted!"`
- `"Your display is now live on the map!"` → `"Your listing is now live on the community board!"`

- [ ] **Step 3: Update page title in `index.html`**

```bash
cd frontend
grep -n "title\|Holiday" src/index.html
```

Change `<title>` to reflect the new brand (e.g., `Community Board`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/shared/navbar/navbar.component.ts \
        frontend/src/app/pages/submit/submit.component.ts \
        frontend/src/index.html
git commit -m "feat: rebrand text to Community Board placeholder"
```

---

## Task 20: End-to-end smoke test

- [ ] **Step 1: Start backend with migration applied**

```bash
cd backend
export $(grep -v '^#' .env | xargs) && mvn spring-boot:run
```

Verify in logs: no errors, Flyway applied migration.

- [ ] **Step 2: Start frontend dev server**

```bash
cd frontend
npm start
```

Open `http://localhost:4200`.

- [ ] **Step 3: Smoke-test golden path**

1. Map loads — displays show with category-colored markers
2. Category filter chips visible in bottom sheet handle
3. Tap a chip (e.g. "Yard Sales") — only yard sale markers remain
4. Tap a marker → detail modal opens showing category badge + date range
5. Navigate to Submit → category picker renders, Christmas Lights shows display-type field, Food Truck shows cuisine field
6. Sign in → My Listings tab shows category badges; expired listings shown muted

- [ ] **Step 4: Create PR**

```bash
cd ..
git push origin feature/frontend-foundation
gh pr create \
  --title "feat: community board — listings with categories, dates, and category-specific fields" \
  --body "Expands the app from Christmas-lights-only to a full community board.

## Changes
- V12 Flyway migration: displays → listings table with category, start/end datetime, and category-specific columns
- New Category enum: CHRISTMAS_LIGHTS, YARD_SALE, ESTATE_SALE, POPUP_MARKET, FOOD_TRUCK
- All Display* Java classes replaced with Listing* equivalents
- New /api/v1/listings endpoints; /api/v1/admin/listings for admin
- Listings auto-expire server-side via end_datetime filter
- Frontend: listing.model.ts, ListingApiService, category filter chips, category-colored markers
- Submit form: category picker at top drives which fields are shown
- Detail modal: category badge, date range, category-specific fields
- Profile: expired listings shown muted with 'Ended' label
- Admin: category column added
- Rebrand text placeholder: 'Community Board'"
```
