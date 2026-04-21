# Christmas Light Map — Backend Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all remaining API endpoints — display search by radius, display CRUD, photo upload to Cloudflare R2, upvotes, reports, tags, and admin report management — so the backend is fully functional and testable via Postman.

**Architecture:** Each feature area gets a `Service` (business logic) + `Controller` (HTTP wiring). `DisplayService` runs a native PostGIS `ST_DWithin` query for radius search; all other queries use Spring Data JPA derived methods. `PhotoService` uploads files to Cloudflare R2 via the existing `S3Client` bean. DB triggers (from Plan 1 migrations) automatically maintain `upvote_count` and `photo_count` — services never update these columns directly.

**Tech Stack:** Spring Boot 3.5, Spring Security 6 (`@PreAuthorize`), Spring Data JPA, Hibernate Spatial, JTS Core 1.19 (`GeometryFactory`), AWS SDK v2 S3Client, Lombok, Testcontainers (tests), Mockito `@MockBean` for S3Client in photo tests.

---

## File Map

| File | Purpose |
|---|---|
| `backend/src/main/java/com/christmaslightmap/repository/DisplayRepository.java` | Native PostGIS radius search queries + tag filter |
| `backend/src/main/java/com/christmaslightmap/repository/UpvoteRepository.java` | existsByUserIdAndDisplayId, deleteByUserIdAndDisplayId |
| `backend/src/main/java/com/christmaslightmap/repository/TagRepository.java` | findAll (no custom queries needed) |
| `backend/src/main/java/com/christmaslightmap/repository/ReportRepository.java` | findByStatus with pagination |
| `backend/src/main/java/com/christmaslightmap/repository/DisplayPhotoRepository.java` | findByDisplay_Id |
| `backend/src/main/java/com/christmaslightmap/dto/request/CreateDisplayRequest.java` | Request body for POST /displays |
| `backend/src/main/java/com/christmaslightmap/dto/request/ReportRequest.java` | Request body for POST /displays/:id/report |
| `backend/src/main/java/com/christmaslightmap/dto/request/UpdateReportRequest.java` | Request body for PATCH /admin/reports/:id |
| `backend/src/main/java/com/christmaslightmap/dto/response/TagResponse.java` | `{id, name}` |
| `backend/src/main/java/com/christmaslightmap/dto/response/PhotoResponse.java` | `{id, url, isPrimary}` |
| `backend/src/main/java/com/christmaslightmap/dto/response/DisplaySummaryResponse.java` | Map pin + card data |
| `backend/src/main/java/com/christmaslightmap/dto/response/DisplayResponse.java` | Full display detail |
| `backend/src/main/java/com/christmaslightmap/dto/response/PagedResponse.java` | Generic paginated wrapper |
| `backend/src/main/java/com/christmaslightmap/dto/response/ReportResponse.java` | Admin report view |
| `backend/src/main/java/com/christmaslightmap/service/TagService.java` | getAll tags |
| `backend/src/main/java/com/christmaslightmap/service/DisplayService.java` | search, getById, create |
| `backend/src/main/java/com/christmaslightmap/service/UpvoteService.java` | upvote, removeUpvote (409 on duplicate) |
| `backend/src/main/java/com/christmaslightmap/service/PhotoService.java` | upload to R2, save DisplayPhoto |
| `backend/src/main/java/com/christmaslightmap/service/ReportService.java` | createReport |
| `backend/src/main/java/com/christmaslightmap/service/AdminService.java` | getReports, updateReport |
| `backend/src/main/java/com/christmaslightmap/controller/TagController.java` | GET /api/v1/tags |
| `backend/src/main/java/com/christmaslightmap/controller/DisplayController.java` | All display endpoints |
| `backend/src/main/java/com/christmaslightmap/controller/AdminController.java` | GET + PATCH /api/v1/admin/reports |
| `backend/src/test/java/com/christmaslightmap/BaseIntegrationTest.java` | Shared Testcontainers base class |
| `backend/src/test/java/com/christmaslightmap/DisplaySearchTest.java` | Radius search integration test |
| `backend/src/test/java/com/christmaslightmap/UpvoteTest.java` | Upvote lifecycle integration test |
| `backend/src/test/java/com/christmaslightmap/PhotoUploadTest.java` | Photo upload with mocked S3Client |
| `backend/src/test/java/com/christmaslightmap/ReportTest.java` | Report creation integration test |
| Modify: `backend/src/test/java/com/christmaslightmap/AuthControllerTest.java` | Extend BaseIntegrationTest |
| Modify: `backend/src/test/java/com/christmaslightmap/ChristmasLightMapApplicationTests.java` | Extend BaseIntegrationTest |

---

## Task 1: Repositories

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/repository/DisplayRepository.java`
- Create: `backend/src/main/java/com/christmaslightmap/repository/UpvoteRepository.java`
- Create: `backend/src/main/java/com/christmaslightmap/repository/TagRepository.java`
- Create: `backend/src/main/java/com/christmaslightmap/repository/ReportRepository.java`
- Create: `backend/src/main/java/com/christmaslightmap/repository/DisplayPhotoRepository.java`

- [ ] **Step 1: Create DisplayRepository.java**

  The native queries use `ST_DWithin` for radius search and return `Object[]` rows that the service will map manually. Two query pairs: one without tag filter, one with. The `findByIdInWithTags` query eagerly loads tags to avoid N+1 in search results.

  ```java
  package com.christmaslightmap.repository;

  import com.christmaslightmap.model.Display;
  import org.springframework.data.jpa.repository.JpaRepository;
  import org.springframework.data.jpa.repository.Query;
  import org.springframework.data.repository.query.Param;

  import java.util.List;

  public interface DisplayRepository extends JpaRepository<Display, Long> {

      @Query(value = """
          SELECT d.id, d.title, d.city, d.state,
                 ST_Y(d.location::geometry) AS lat, ST_X(d.location::geometry) AS lng,
                 d.upvote_count, d.photo_count, d.display_type, d.created_at,
                 (SELECT p.url FROM display_photos p
                  WHERE p.display_id = d.id AND p.is_primary = true LIMIT 1) AS primary_photo_url
          FROM displays d
          WHERE d.is_active = true
            AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
            AND (:displayType IS NULL OR d.display_type = :displayType)
          ORDER BY d.upvote_count DESC
          LIMIT :lim OFFSET :off
          """, nativeQuery = true)
      List<Object[]> searchDisplays(
          @Param("lat") double lat,
          @Param("lng") double lng,
          @Param("radiusMetres") double radiusMetres,
          @Param("displayType") String displayType,
          @Param("lim") int limit,
          @Param("off") int offset
      );

      @Query(value = """
          SELECT COUNT(*) FROM displays d
          WHERE d.is_active = true
            AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
            AND (:displayType IS NULL OR d.display_type = :displayType)
          """, nativeQuery = true)
      long countSearchDisplays(
          @Param("lat") double lat,
          @Param("lng") double lng,
          @Param("radiusMetres") double radiusMetres,
          @Param("displayType") String displayType
      );

      @Query(value = """
          SELECT d.id, d.title, d.city, d.state,
                 ST_Y(d.location::geometry) AS lat, ST_X(d.location::geometry) AS lng,
                 d.upvote_count, d.photo_count, d.display_type, d.created_at,
                 (SELECT p.url FROM display_photos p
                  WHERE p.display_id = d.id AND p.is_primary = true LIMIT 1) AS primary_photo_url
          FROM displays d
          WHERE d.is_active = true
            AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
            AND (:displayType IS NULL OR d.display_type = :displayType)
            AND EXISTS (SELECT 1 FROM display_tags dt WHERE dt.display_id = d.id AND dt.tag_id IN (:tagIds))
          ORDER BY d.upvote_count DESC
          LIMIT :lim OFFSET :off
          """, nativeQuery = true)
      List<Object[]> searchDisplaysWithTags(
          @Param("lat") double lat,
          @Param("lng") double lng,
          @Param("radiusMetres") double radiusMetres,
          @Param("displayType") String displayType,
          @Param("tagIds") List<Long> tagIds,
          @Param("lim") int limit,
          @Param("off") int offset
      );

      @Query(value = """
          SELECT COUNT(*) FROM displays d
          WHERE d.is_active = true
            AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
            AND (:displayType IS NULL OR d.display_type = :displayType)
            AND EXISTS (SELECT 1 FROM display_tags dt WHERE dt.display_id = d.id AND dt.tag_id IN (:tagIds))
          """, nativeQuery = true)
      long countSearchDisplaysWithTags(
          @Param("lat") double lat,
          @Param("lng") double lng,
          @Param("radiusMetres") double radiusMetres,
          @Param("displayType") String displayType,
          @Param("tagIds") List<Long> tagIds
      );

      @Query("SELECT d FROM Display d LEFT JOIN FETCH d.tags WHERE d.id IN :ids")
      List<Display> findByIdInWithTags(@Param("ids") List<Long> ids);

      List<Display> findByUserIdAndIsActiveTrue(Long userId);
  }
  ```

- [ ] **Step 2: Create UpvoteRepository.java**

  ```java
  package com.christmaslightmap.repository;

  import com.christmaslightmap.model.Upvote;
  import org.springframework.data.jpa.repository.JpaRepository;
  import org.springframework.data.jpa.repository.Query;
  import org.springframework.data.repository.query.Param;
  import org.springframework.transaction.annotation.Transactional;

  import java.util.List;

  public interface UpvoteRepository extends JpaRepository<Upvote, Long> {
      boolean existsByUserIdAndDisplayId(Long userId, Long displayId);

      @Transactional
      void deleteByUserIdAndDisplayId(Long userId, Long displayId);

      @Query("SELECT u FROM Upvote u JOIN FETCH u.display d WHERE u.user.id = :userId AND d.isActive = true")
      List<Upvote> findByUserIdWithActiveDisplays(@Param("userId") Long userId);
  }
  ```

- [ ] **Step 3: Create TagRepository.java**

  ```java
  package com.christmaslightmap.repository;

  import com.christmaslightmap.model.Tag;
  import org.springframework.data.jpa.repository.JpaRepository;

  import java.util.List;

  public interface TagRepository extends JpaRepository<Tag, Long> {
      List<Tag> findAllByOrderByNameAsc();
  }
  ```

- [ ] **Step 4: Create ReportRepository.java**

  ```java
  package com.christmaslightmap.repository;

  import com.christmaslightmap.model.Report;
  import com.christmaslightmap.model.ReportStatus;
  import org.springframework.data.domain.Page;
  import org.springframework.data.domain.Pageable;
  import org.springframework.data.jpa.repository.JpaRepository;

  public interface ReportRepository extends JpaRepository<Report, Long> {
      Page<Report> findByStatus(ReportStatus status, Pageable pageable);
  }
  ```

- [ ] **Step 5: Create DisplayPhotoRepository.java**

  ```java
  package com.christmaslightmap.repository;

  import com.christmaslightmap.model.DisplayPhoto;
  import org.springframework.data.jpa.repository.JpaRepository;

  import java.util.List;

  public interface DisplayPhotoRepository extends JpaRepository<DisplayPhoto, Long> {
      List<DisplayPhoto> findByDisplay_Id(Long displayId);
  }
  ```

- [ ] **Step 6: Verify compilation**

  ```bash
  cd backend && ./mvnw compile -q
  ```

  Expected: no output (clean build).

- [ ] **Step 7: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/repository/
  git commit -m "feat: add DisplayRepository (PostGIS search), UpvoteRepository, TagRepository, ReportRepository, DisplayPhotoRepository"
  ```

---

## Task 2: DTOs

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/dto/request/CreateDisplayRequest.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/request/ReportRequest.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/request/UpdateReportRequest.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/TagResponse.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/PhotoResponse.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/DisplaySummaryResponse.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/DisplayResponse.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/PagedResponse.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/ReportResponse.java`

- [ ] **Step 1: Create CreateDisplayRequest.java**

  The frontend geocodes the address and sends `lat`/`lng` — users never enter coordinates manually.

  ```java
  package com.christmaslightmap.dto.request;

  import com.christmaslightmap.model.DisplayType;
  import lombok.Data;

  import java.util.List;

  @Data
  public class CreateDisplayRequest {
      private String title;
      private String description;
      private String address;
      private String city;
      private String state;
      private String postcode;
      private double lat;
      private double lng;
      private String bestTime;
      private DisplayType displayType;
      private List<Long> tagIds = List.of();
  }
  ```

- [ ] **Step 2: Create ReportRequest.java**

  ```java
  package com.christmaslightmap.dto.request;

  import com.christmaslightmap.model.ReportReason;
  import lombok.Data;

  @Data
  public class ReportRequest {
      private ReportReason reason;
      private String notes;
  }
  ```

- [ ] **Step 3: Create UpdateReportRequest.java**

  ```java
  package com.christmaslightmap.dto.request;

  import com.christmaslightmap.model.ReportStatus;
  import lombok.Data;

  @Data
  public class UpdateReportRequest {
      private ReportStatus status;
  }
  ```

- [ ] **Step 4: Create TagResponse.java**

  ```java
  package com.christmaslightmap.dto.response;

  import com.christmaslightmap.model.Tag;
  import lombok.Builder;
  import lombok.Data;

  @Data
  @Builder
  public class TagResponse {
      private Long id;
      private String name;

      public static TagResponse from(Tag tag) {
          return TagResponse.builder()
              .id(tag.getId())
              .name(tag.getName())
              .build();
      }
  }
  ```

- [ ] **Step 5: Create PhotoResponse.java**

  ```java
  package com.christmaslightmap.dto.response;

  import com.christmaslightmap.model.DisplayPhoto;
  import lombok.Builder;
  import lombok.Data;

  @Data
  @Builder
  public class PhotoResponse {
      private Long id;
      private String url;
      private boolean isPrimary;

      public static PhotoResponse from(DisplayPhoto photo) {
          return PhotoResponse.builder()
              .id(photo.getId())
              .url(photo.getUrl())
              .isPrimary(photo.isPrimary())
              .build();
      }
  }
  ```

- [ ] **Step 6: Create DisplaySummaryResponse.java**

  Used for map pins and cards. Tags populated separately after the native search query.

  ```java
  package com.christmaslightmap.dto.response;

  import lombok.Builder;
  import lombok.Data;

  import java.util.List;

  @Data
  @Builder
  public class DisplaySummaryResponse {
      private Long id;
      private String title;
      private String city;
      private String state;
      private double lat;
      private double lng;
      private int upvoteCount;
      private int photoCount;
      private String displayType;
      private String primaryPhotoUrl;
      private List<TagResponse> tags;
  }
  ```

- [ ] **Step 7: Create DisplayResponse.java**

  Full display detail including photos and tags.

  ```java
  package com.christmaslightmap.dto.response;

  import com.christmaslightmap.model.Display;
  import com.christmaslightmap.model.DisplayPhoto;
  import lombok.Builder;
  import lombok.Data;

  import java.time.LocalDateTime;
  import java.util.List;
  import java.util.stream.Collectors;

  @Data
  @Builder
  public class DisplayResponse {
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
      private String bestTime;
      private String displayType;
      private int upvoteCount;
      private int photoCount;
      private boolean isActive;
      private LocalDateTime createdAt;
      private List<TagResponse> tags;
      private List<PhotoResponse> photos;

      public static DisplayResponse from(Display display, List<DisplayPhoto> photos) {
          return DisplayResponse.builder()
              .id(display.getId())
              .submittedBy(display.getUser().getId())
              .title(display.getTitle())
              .description(display.getDescription())
              .address(display.getAddress())
              .city(display.getCity())
              .state(display.getState())
              .postcode(display.getPostcode())
              .lat(display.getLocation().getY())
              .lng(display.getLocation().getX())
              .bestTime(display.getBestTime())
              .displayType(display.getDisplayType().name())
              .upvoteCount(display.getUpvoteCount())
              .photoCount(display.getPhotoCount())
              .isActive(display.isActive())
              .createdAt(display.getCreatedAt())
              .tags(display.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
              .photos(photos.stream().map(PhotoResponse::from).collect(Collectors.toList()))
              .build();
      }
  }
  ```

- [ ] **Step 8: Create PagedResponse.java**

  ```java
  package com.christmaslightmap.dto.response;

  import lombok.AllArgsConstructor;
  import lombok.Builder;
  import lombok.Data;
  import lombok.NoArgsConstructor;

  import java.util.List;

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public class PagedResponse<T> {
      private List<T> content;
      private int page;
      private int size;
      private long totalElements;
      private int totalPages;
      private boolean last;
  }
  ```

- [ ] **Step 9: Create ReportResponse.java**

  ```java
  package com.christmaslightmap.dto.response;

  import com.christmaslightmap.model.Report;
  import lombok.Builder;
  import lombok.Data;

  import java.time.LocalDateTime;

  @Data
  @Builder
  public class ReportResponse {
      private Long id;
      private Long displayId;
      private String displayTitle;
      private Long reporterId;
      private String reporterName;
      private String reason;
      private String notes;
      private String status;
      private LocalDateTime createdAt;

      public static ReportResponse from(Report report) {
          return ReportResponse.builder()
              .id(report.getId())
              .displayId(report.getDisplay().getId())
              .displayTitle(report.getDisplay().getTitle())
              .reporterId(report.getUser().getId())
              .reporterName(report.getUser().getName())
              .reason(report.getReason().name())
              .notes(report.getNotes())
              .status(report.getStatus().name())
              .createdAt(report.getCreatedAt())
              .build();
      }
  }
  ```

- [ ] **Step 10: Verify compilation**

  ```bash
  cd backend && ./mvnw compile -q
  ```

  Expected: no output.

- [ ] **Step 11: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/dto/
  git commit -m "feat: add request and response DTOs (CreateDisplayRequest, DisplaySummaryResponse, DisplayResponse, PagedResponse, etc.)"
  ```

---

## Task 3: TagService + TagController

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/service/TagService.java`
- Create: `backend/src/main/java/com/christmaslightmap/controller/TagController.java`

- [ ] **Step 1: Create TagService.java**

  ```java
  package com.christmaslightmap.service;

  import com.christmaslightmap.dto.response.TagResponse;
  import com.christmaslightmap.repository.TagRepository;
  import lombok.RequiredArgsConstructor;
  import org.springframework.stereotype.Service;
  import org.springframework.transaction.annotation.Transactional;

  import java.util.List;
  import java.util.stream.Collectors;

  @Service
  @RequiredArgsConstructor
  @Transactional(readOnly = true)
  public class TagService {

      private final TagRepository tagRepository;

      public List<TagResponse> getAll() {
          return tagRepository.findAllByOrderByNameAsc().stream()
              .map(TagResponse::from)
              .collect(Collectors.toList());
      }
  }
  ```

- [ ] **Step 2: Create TagController.java**

  ```java
  package com.christmaslightmap.controller;

  import com.christmaslightmap.dto.response.ApiResponse;
  import com.christmaslightmap.dto.response.TagResponse;
  import com.christmaslightmap.service.TagService;
  import lombok.RequiredArgsConstructor;
  import org.springframework.http.ResponseEntity;
  import org.springframework.web.bind.annotation.GetMapping;
  import org.springframework.web.bind.annotation.RequestMapping;
  import org.springframework.web.bind.annotation.RestController;

  import java.util.List;

  @RestController
  @RequestMapping("/api/v1/tags")
  @RequiredArgsConstructor
  public class TagController {

      private final TagService tagService;

      @GetMapping
      public ResponseEntity<ApiResponse<List<TagResponse>>> getTags() {
          return ResponseEntity.ok(ApiResponse.success(tagService.getAll()));
      }
  }
  ```

- [ ] **Step 3: Verify GET /api/v1/tags returns the 6 seeded tags**

  Start Docker and backend (requires .env):
  ```bash
  docker-compose up -d
  source backend/.env && cd backend && ./mvnw spring-boot:run
  ```

  In a separate terminal:
  ```bash
  curl -s http://localhost:8080/api/v1/tags | python -m json.tool
  ```

  Expected: JSON with 6 tags (animated, drive-by, inflatables, lights-only, music-synced, walk-through) sorted alphabetically, wrapped in `{"success":true,"data":[...]}`.

  Stop the app with Ctrl+C.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/service/TagService.java \
           backend/src/main/java/com/christmaslightmap/controller/TagController.java
  git commit -m "feat: add TagService and TagController (GET /api/v1/tags)"
  ```

---

## Task 4: Shared Test Base + DisplayService (search) + DisplaySearchTest

**Files:**
- Create: `backend/src/test/java/com/christmaslightmap/BaseIntegrationTest.java`
- Modify: `backend/src/test/java/com/christmaslightmap/AuthControllerTest.java`
- Modify: `backend/src/test/java/com/christmaslightmap/ChristmasLightMapApplicationTests.java`
- Create: `backend/src/main/java/com/christmaslightmap/service/DisplayService.java` (search method only)
- Create: `backend/src/test/java/com/christmaslightmap/DisplaySearchTest.java`

- [ ] **Step 1: Create BaseIntegrationTest.java**

  All integration tests extend this. It spins up one shared Testcontainers PostgreSQL container per JVM run.

  ```java
  package com.christmaslightmap;

  import org.springframework.boot.test.context.SpringBootTest;
  import org.springframework.test.context.ActiveProfiles;
  import org.springframework.test.context.DynamicPropertyRegistry;
  import org.springframework.test.context.DynamicPropertySource;
  import org.testcontainers.containers.PostgreSQLContainer;
  import org.testcontainers.junit.jupiter.Container;
  import org.testcontainers.junit.jupiter.Testcontainers;
  import org.testcontainers.utility.DockerImageName;

  @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
  @Testcontainers
  @ActiveProfiles("test")
  public abstract class BaseIntegrationTest {

      @Container
      static PostgreSQLContainer<?> postgres =
          new PostgreSQLContainer<>(
              DockerImageName.parse("postgis/postgis:15-3.3")
                  .asCompatibleSubstituteFor("postgres"))
              .withDatabaseName("testdb")
              .withUsername("test")
              .withPassword("test");

      @DynamicPropertySource
      static void configureProperties(DynamicPropertyRegistry registry) {
          registry.add("spring.datasource.url", postgres::getJdbcUrl);
          registry.add("spring.datasource.username", postgres::getUsername);
          registry.add("spring.datasource.password", postgres::getPassword);
      }
  }
  ```

- [ ] **Step 2: Update AuthControllerTest.java to extend BaseIntegrationTest**

  Remove the `@SpringBootTest`, `@Testcontainers`, `@ActiveProfiles`, `@Container` block, `@DynamicPropertySource` block, and the four Testcontainers imports. Add `extends BaseIntegrationTest` to the class declaration.

  The class declaration line changes from:
  ```java
  @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
  @Testcontainers
  @ActiveProfiles("test")
  class AuthControllerTest {
  ```
  To:
  ```java
  class AuthControllerTest extends BaseIntegrationTest {
  ```

  And remove lines 9–20 (the Testcontainers imports), the `@Container` field (lines 28–35), and the `@DynamicPropertySource` method (lines 37–42). Keep all `@Test` methods and `@Autowired` fields unchanged.

  Full updated file:
  ```java
  package com.christmaslightmap;

  import com.christmaslightmap.model.User;
  import com.christmaslightmap.model.UserRole;
  import com.christmaslightmap.repository.UserRepository;
  import com.christmaslightmap.security.JwtService;
  import org.junit.jupiter.api.AfterEach;
  import org.junit.jupiter.api.Test;
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.boot.test.web.client.TestRestTemplate;
  import org.springframework.http.*;

  import static org.assertj.core.api.Assertions.assertThat;

  class AuthControllerTest extends BaseIntegrationTest {

      @Autowired
      private TestRestTemplate restTemplate;

      @Autowired
      private JwtService jwtService;

      @Autowired
      private UserRepository userRepository;

      @AfterEach
      void cleanUp() {
          userRepository.deleteAll();
      }

      @Test
      void getMe_withoutCookie_returns401() {
          ResponseEntity<String> response =
              restTemplate.getForEntity("/api/v1/auth/me", String.class);
          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
      }

      @Test
      void getMe_withValidCookie_returns200WithUser() {
          User user = userRepository.save(User.builder()
              .provider("google")
              .providerId("google-test-123")
              .email("test@example.com")
              .name("Test User")
              .role(UserRole.USER)
              .build());

          String token = jwtService.generateToken(user);

          HttpHeaders headers = new HttpHeaders();
          headers.add("Cookie", "jwt=" + token);
          HttpEntity<Void> request = new HttpEntity<>(headers);

          ResponseEntity<String> response = restTemplate.exchange(
              "/api/v1/auth/me", HttpMethod.GET, request, String.class);

          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
          assertThat(response.getBody()).contains("test@example.com");
          assertThat(response.getBody()).contains("\"success\":true");
      }

      @Test
      void logout_clearsCookie() {
          User user = userRepository.save(User.builder()
              .provider("google")
              .providerId("google-test-456")
              .email("logout@example.com")
              .name("Logout User")
              .role(UserRole.USER)
              .build());

          String token = jwtService.generateToken(user);
          HttpHeaders headers = new HttpHeaders();
          headers.add("Cookie", "jwt=" + token);
          HttpEntity<Void> request = new HttpEntity<>(headers);

          ResponseEntity<String> response = restTemplate.exchange(
              "/api/v1/auth/logout", HttpMethod.POST, request, String.class);

          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
          assertThat(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE))
              .contains("jwt=")
              .contains("Max-Age=0");
      }
  }
  ```

- [ ] **Step 3: Update ChristmasLightMapApplicationTests.java to extend BaseIntegrationTest**

  Replace its entire content with:
  ```java
  package com.christmaslightmap;

  import org.junit.jupiter.api.Test;

  class ChristmasLightMapApplicationTests extends BaseIntegrationTest {

      @Test
      void contextLoads() {
      }
  }
  ```

- [ ] **Step 4: Write the failing DisplaySearchTest**

  Create `backend/src/test/java/com/christmaslightmap/DisplaySearchTest.java`:

  ```java
  package com.christmaslightmap;

  import com.christmaslightmap.model.Display;
  import com.christmaslightmap.model.User;
  import com.christmaslightmap.model.UserRole;
  import com.christmaslightmap.repository.DisplayRepository;
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

  import static org.assertj.core.api.Assertions.assertThat;

  class DisplaySearchTest extends BaseIntegrationTest {

      private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

      @Autowired private TestRestTemplate restTemplate;
      @Autowired private DisplayRepository displayRepository;
      @Autowired private UserRepository userRepository;

      @AfterEach
      void cleanUp() {
          displayRepository.deleteAll();
          userRepository.deleteAll();
      }

      private Point point(double lng, double lat) {
          Point p = GF.createPoint(new Coordinate(lng, lat));
          p.setSRID(4326);
          return p;
      }

      @Test
      void search_withinRadius_returnsOnlyNearbyDisplays() {
          User user = userRepository.save(User.builder()
              .provider("google").providerId("g1").email("u@test.com")
              .name("User").role(UserRole.USER).build());

          // Two displays near Seattle (47.6062, -122.3321)
          displayRepository.save(Display.builder().user(user).title("Seattle Display 1")
              .location(point(-122.3321, 47.6062)).build());
          displayRepository.save(Display.builder().user(user).title("Seattle Display 2")
              .location(point(-122.30, 47.61)).build());
          // One display in Portland (~174 miles away) — outside 10-mile radius
          displayRepository.save(Display.builder().user(user).title("Portland Display")
              .location(point(-122.6750, 45.5051)).build());

          ResponseEntity<String> response = restTemplate.getForEntity(
              "/api/v1/displays/search?lat=47.6062&lng=-122.3321&radiusMiles=10", String.class);

          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
          assertThat(response.getBody()).contains("Seattle Display 1");
          assertThat(response.getBody()).contains("Seattle Display 2");
          assertThat(response.getBody()).doesNotContain("Portland Display");
      }

      @Test
      void search_emptyArea_returnsEmptyPage() {
          ResponseEntity<String> response = restTemplate.getForEntity(
              "/api/v1/displays/search?lat=0.0&lng=0.0&radiusMiles=1", String.class);

          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
          assertThat(response.getBody()).contains("\"totalElements\":0");
      }
  }
  ```

- [ ] **Step 5: Run test to confirm it fails (DisplayService missing)**

  ```bash
  cd backend && ./mvnw test -Dtest=DisplaySearchTest -q 2>&1 | tail -5
  ```

  Expected: compilation error or startup failure — `DisplayService` and `DisplayController` don't exist yet.

- [ ] **Step 6: Create DisplayService.java (search method only)**

  ```java
  package com.christmaslightmap.service;

  import com.christmaslightmap.dto.response.DisplayResponse;
  import com.christmaslightmap.dto.response.DisplaySummaryResponse;
  import com.christmaslightmap.dto.response.PagedResponse;
  import com.christmaslightmap.dto.response.TagResponse;
  import com.christmaslightmap.dto.request.CreateDisplayRequest;
  import com.christmaslightmap.model.Display;
  import com.christmaslightmap.model.DisplayType;
  import com.christmaslightmap.repository.DisplayPhotoRepository;
  import com.christmaslightmap.repository.DisplayRepository;
  import com.christmaslightmap.repository.TagRepository;
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

  import java.util.HashSet;
  import java.util.List;
  import java.util.Map;
  import java.util.stream.Collectors;

  @Service
  @RequiredArgsConstructor
  @Transactional(readOnly = true)
  public class DisplayService {

      private static final GeometryFactory GEOMETRY_FACTORY =
          new GeometryFactory(new PrecisionModel(), 4326);

      private final DisplayRepository displayRepository;
      private final UserRepository userRepository;
      private final TagRepository tagRepository;
      private final DisplayPhotoRepository displayPhotoRepository;

      public PagedResponse<DisplaySummaryResponse> searchDisplays(
              double lat, double lng, double radiusMiles,
              List<Long> tagIds, String displayType, int page, int size) {

          double radiusMetres = radiusMiles * 1609.34;
          int offset = page * size;
          String displayTypeStr = (displayType != null && !displayType.isBlank()) ? displayType : null;

          List<Object[]> rows;
          long total;
          if (tagIds == null || tagIds.isEmpty()) {
              rows = displayRepository.searchDisplays(lat, lng, radiusMetres, displayTypeStr, size, offset);
              total = displayRepository.countSearchDisplays(lat, lng, radiusMetres, displayTypeStr);
          } else {
              rows = displayRepository.searchDisplaysWithTags(lat, lng, radiusMetres, displayTypeStr, tagIds, size, offset);
              total = displayRepository.countSearchDisplaysWithTags(lat, lng, radiusMetres, displayTypeStr, tagIds);
          }

          List<DisplaySummaryResponse> summaries = rows.stream()
              .map(this::mapRowToSummary)
              .collect(Collectors.toList());

          if (!summaries.isEmpty()) {
              List<Long> ids = summaries.stream().map(DisplaySummaryResponse::getId).collect(Collectors.toList());
              List<Display> withTags = displayRepository.findByIdInWithTags(ids);
              Map<Long, List<TagResponse>> tagMap = withTags.stream().collect(Collectors.toMap(
                  Display::getId,
                  d -> d.getTags().stream().map(TagResponse::from).collect(Collectors.toList())
              ));
              summaries.forEach(s -> s.setTags(tagMap.getOrDefault(s.getId(), List.of())));
          }

          return PagedResponse.<DisplaySummaryResponse>builder()
              .content(summaries)
              .page(page)
              .size(size)
              .totalElements(total)
              .totalPages(total == 0 ? 0 : (int) Math.ceil((double) total / size))
              .last((long) (offset + size) >= total)
              .build();
      }

      public DisplayResponse getById(Long id) {
          Display display = displayRepository.findById(id)
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Display not found"));
          return DisplayResponse.from(display, displayPhotoRepository.findByDisplay_Id(id));
      }

      @Transactional
      public DisplayResponse createDisplay(Long userId, CreateDisplayRequest request) {
          var user = userRepository.findById(userId)
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

          Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(request.getLng(), request.getLat()));
          location.setSRID(4326);

          var tags = new HashSet<>(tagRepository.findAllById(
              request.getTagIds() != null ? request.getTagIds() : List.of()));

          Display display = displayRepository.save(Display.builder()
              .user(user)
              .title(request.getTitle())
              .description(request.getDescription())
              .address(request.getAddress())
              .city(request.getCity())
              .state(request.getState())
              .postcode(request.getPostcode())
              .location(location)
              .bestTime(request.getBestTime())
              .displayType(request.getDisplayType() != null ? request.getDisplayType() : DisplayType.DRIVE_BY)
              .tags(tags)
              .build());

          return DisplayResponse.from(display, List.of());
      }

      private DisplaySummaryResponse mapRowToSummary(Object[] row) {
          return DisplaySummaryResponse.builder()
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
              .tags(List.of())
              .build();
      }
  }
  ```

- [ ] **Step 7: Create DisplayController.java (search + getById + create)**

  ```java
  package com.christmaslightmap.controller;

  import com.christmaslightmap.dto.request.CreateDisplayRequest;
  import com.christmaslightmap.dto.response.ApiResponse;
  import com.christmaslightmap.dto.response.DisplayResponse;
  import com.christmaslightmap.dto.response.DisplaySummaryResponse;
  import com.christmaslightmap.dto.response.PagedResponse;
  import com.christmaslightmap.service.DisplayService;
  import lombok.RequiredArgsConstructor;
  import org.springframework.http.HttpStatus;
  import org.springframework.http.ResponseEntity;
  import org.springframework.security.core.Authentication;
  import org.springframework.web.bind.annotation.*;

  import java.util.List;

  @RestController
  @RequestMapping("/api/v1/displays")
  @RequiredArgsConstructor
  public class DisplayController {

      private final DisplayService displayService;

      @GetMapping("/search")
      public ResponseEntity<ApiResponse<PagedResponse<DisplaySummaryResponse>>> search(
          @RequestParam double lat,
          @RequestParam double lng,
          @RequestParam(defaultValue = "10") double radiusMiles,
          @RequestParam(required = false) List<Long> tags,
          @RequestParam(required = false) String displayType,
          @RequestParam(defaultValue = "0") int page,
          @RequestParam(defaultValue = "50") int size
      ) {
          return ResponseEntity.ok(ApiResponse.success(
              displayService.searchDisplays(lat, lng, radiusMiles, tags, displayType, page, size)));
      }

      @GetMapping("/{id}")
      public ResponseEntity<ApiResponse<DisplayResponse>> getById(@PathVariable Long id) {
          return ResponseEntity.ok(ApiResponse.success(displayService.getById(id)));
      }

      @PostMapping
      public ResponseEntity<ApiResponse<DisplayResponse>> create(
          @RequestBody CreateDisplayRequest request,
          Authentication authentication
      ) {
          Long userId = (Long) authentication.getPrincipal();
          return ResponseEntity.status(HttpStatus.CREATED)
              .body(ApiResponse.success(displayService.createDisplay(userId, request)));
      }
  }
  ```

- [ ] **Step 8: Run DisplaySearchTest — confirm it passes**

  ```bash
  cd backend && ./mvnw test -Dtest=DisplaySearchTest -q 2>&1 | tail -5
  ```

  Expected: `Tests run: 2, Failures: 0, Errors: 0`

- [ ] **Step 9: Commit**

  ```bash
  git add backend/src/test/java/com/christmaslightmap/BaseIntegrationTest.java \
           backend/src/test/java/com/christmaslightmap/AuthControllerTest.java \
           backend/src/test/java/com/christmaslightmap/ChristmasLightMapApplicationTests.java \
           backend/src/main/java/com/christmaslightmap/service/DisplayService.java \
           backend/src/main/java/com/christmaslightmap/controller/DisplayController.java \
           backend/src/test/java/com/christmaslightmap/DisplaySearchTest.java
  git commit -m "feat: add DisplayService (PostGIS radius search), DisplayController, BaseIntegrationTest, DisplaySearchTest"
  ```

---

## Task 5: UpvoteService + Endpoints + UpvoteTest

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/service/UpvoteService.java`
- Modify: `backend/src/main/java/com/christmaslightmap/controller/DisplayController.java`
- Create: `backend/src/test/java/com/christmaslightmap/UpvoteTest.java`

- [ ] **Step 1: Write the failing UpvoteTest**

  ```java
  package com.christmaslightmap;

  import com.christmaslightmap.model.Display;
  import com.christmaslightmap.model.User;
  import com.christmaslightmap.model.UserRole;
  import com.christmaslightmap.repository.DisplayRepository;
  import com.christmaslightmap.repository.UserRepository;
  import com.christmaslightmap.security.JwtService;
  import org.junit.jupiter.api.AfterEach;
  import org.junit.jupiter.api.BeforeEach;
  import org.junit.jupiter.api.Test;
  import org.locationtech.jts.geom.Coordinate;
  import org.locationtech.jts.geom.GeometryFactory;
  import org.locationtech.jts.geom.PrecisionModel;
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.boot.test.web.client.TestRestTemplate;
  import org.springframework.http.*;

  import static org.assertj.core.api.Assertions.assertThat;

  class UpvoteTest extends BaseIntegrationTest {

      private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

      @Autowired private TestRestTemplate restTemplate;
      @Autowired private JwtService jwtService;
      @Autowired private UserRepository userRepository;
      @Autowired private DisplayRepository displayRepository;

      private User user;
      private Display display;
      private HttpHeaders authHeaders;

      @BeforeEach
      void setUp() {
          user = userRepository.save(User.builder()
              .provider("google").providerId("g1").email("voter@test.com")
              .name("Voter").role(UserRole.USER).build());

          var loc = GF.createPoint(new Coordinate(-122.3321, 47.6062));
          loc.setSRID(4326);
          display = displayRepository.save(Display.builder()
              .user(user).title("Test Display").location(loc).build());

          authHeaders = new HttpHeaders();
          authHeaders.add("Cookie", "jwt=" + jwtService.generateToken(user));
      }

      @AfterEach
      void cleanUp() {
          displayRepository.deleteAll();
          userRepository.deleteAll();
      }

      @Test
      void upvote_returns200AndCountIncrements() {
          ResponseEntity<String> response = restTemplate.exchange(
              "/api/v1/displays/" + display.getId() + "/upvote",
              HttpMethod.POST, new HttpEntity<>(authHeaders), String.class);

          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

          Display updated = displayRepository.findById(display.getId()).orElseThrow();
          assertThat(updated.getUpvoteCount()).isEqualTo(1);
      }

      @Test
      void upvote_twice_returns409() {
          HttpEntity<Void> req = new HttpEntity<>(authHeaders);
          restTemplate.exchange("/api/v1/displays/" + display.getId() + "/upvote",
              HttpMethod.POST, req, String.class);

          ResponseEntity<String> second = restTemplate.exchange(
              "/api/v1/displays/" + display.getId() + "/upvote",
              HttpMethod.POST, req, String.class);

          assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
      }

      @Test
      void removeUpvote_returns200AndCountDecrements() {
          HttpEntity<Void> req = new HttpEntity<>(authHeaders);
          restTemplate.exchange("/api/v1/displays/" + display.getId() + "/upvote",
              HttpMethod.POST, req, String.class);

          ResponseEntity<String> remove = restTemplate.exchange(
              "/api/v1/displays/" + display.getId() + "/upvote",
              HttpMethod.DELETE, req, String.class);

          assertThat(remove.getStatusCode()).isEqualTo(HttpStatus.OK);

          Display updated = displayRepository.findById(display.getId()).orElseThrow();
          assertThat(updated.getUpvoteCount()).isEqualTo(0);
      }
  }
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd backend && ./mvnw test -Dtest=UpvoteTest -q 2>&1 | tail -5
  ```

  Expected: HTTP 403 or 404 — endpoints don't exist yet.

- [ ] **Step 3: Create UpvoteService.java**

  ```java
  package com.christmaslightmap.service;

  import com.christmaslightmap.model.Upvote;
  import com.christmaslightmap.repository.DisplayRepository;
  import com.christmaslightmap.repository.UpvoteRepository;
  import com.christmaslightmap.repository.UserRepository;
  import lombok.RequiredArgsConstructor;
  import org.springframework.http.HttpStatus;
  import org.springframework.stereotype.Service;
  import org.springframework.transaction.annotation.Transactional;
  import org.springframework.web.server.ResponseStatusException;

  @Service
  @RequiredArgsConstructor
  public class UpvoteService {

      private final UpvoteRepository upvoteRepository;
      private final DisplayRepository displayRepository;
      private final UserRepository userRepository;

      @Transactional
      public void upvote(Long userId, Long displayId) {
          if (upvoteRepository.existsByUserIdAndDisplayId(userId, displayId)) {
              throw new ResponseStatusException(HttpStatus.CONFLICT, "Already upvoted");
          }
          var display = displayRepository.findById(displayId)
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Display not found"));
          var user = userRepository.findById(userId)
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
          upvoteRepository.save(Upvote.builder().user(user).display(display).build());
      }

      @Transactional
      public void removeUpvote(Long userId, Long displayId) {
          if (!upvoteRepository.existsByUserIdAndDisplayId(userId, displayId)) {
              throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Upvote not found");
          }
          upvoteRepository.deleteByUserIdAndDisplayId(userId, displayId);
      }
  }
  ```

- [ ] **Step 4: Add upvote endpoints to DisplayController.java**

  Add these two methods to the existing `DisplayController` class (after the `create` method). Also add `private final UpvoteService upvoteService;` to the constructor injection (Lombok handles this via `@RequiredArgsConstructor` — just add the field).

  Add field:
  ```java
  private final UpvoteService upvoteService;
  ```

  Add methods:
  ```java
  @PostMapping("/{id}/upvote")
  public ResponseEntity<ApiResponse<Void>> upvote(
      @PathVariable Long id,
      Authentication authentication
  ) {
      Long userId = (Long) authentication.getPrincipal();
      upvoteService.upvote(userId, id);
      return ResponseEntity.ok(ApiResponse.success(null));
  }

  @DeleteMapping("/{id}/upvote")
  public ResponseEntity<ApiResponse<Void>> removeUpvote(
      @PathVariable Long id,
      Authentication authentication
  ) {
      Long userId = (Long) authentication.getPrincipal();
      upvoteService.removeUpvote(userId, id);
      return ResponseEntity.ok(ApiResponse.success(null));
  }
  ```

- [ ] **Step 5: Run UpvoteTest — confirm it passes**

  ```bash
  cd backend && ./mvnw test -Dtest=UpvoteTest -q 2>&1 | tail -5
  ```

  Expected: `Tests run: 3, Failures: 0, Errors: 0`

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/service/UpvoteService.java \
           backend/src/main/java/com/christmaslightmap/controller/DisplayController.java \
           backend/src/test/java/com/christmaslightmap/UpvoteTest.java
  git commit -m "feat: add UpvoteService and upvote endpoints (POST/DELETE /displays/:id/upvote) with 409 on duplicate"
  ```

---

## Task 6: PhotoService + Photo Endpoint + PhotoUploadTest

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/service/PhotoService.java`
- Modify: `backend/src/main/java/com/christmaslightmap/controller/DisplayController.java`
- Create: `backend/src/test/java/com/christmaslightmap/PhotoUploadTest.java`

- [ ] **Step 1: Write the failing PhotoUploadTest**

  The `@MockBean S3Client` replaces the real S3Client bean so no actual R2 call is made.

  ```java
  package com.christmaslightmap;

  import com.christmaslightmap.model.Display;
  import com.christmaslightmap.model.User;
  import com.christmaslightmap.model.UserRole;
  import com.christmaslightmap.repository.DisplayPhotoRepository;
  import com.christmaslightmap.repository.DisplayRepository;
  import com.christmaslightmap.repository.UserRepository;
  import com.christmaslightmap.security.JwtService;
  import org.junit.jupiter.api.AfterEach;
  import org.junit.jupiter.api.Test;
  import org.locationtech.jts.geom.Coordinate;
  import org.locationtech.jts.geom.GeometryFactory;
  import org.locationtech.jts.geom.PrecisionModel;
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.boot.test.mock.mockito.MockBean;
  import org.springframework.boot.test.web.client.TestRestTemplate;
  import org.springframework.core.io.ByteArrayResource;
  import org.springframework.http.*;
  import org.springframework.util.LinkedMultiValueMap;
  import org.springframework.util.MultiValueMap;
  import software.amazon.awssdk.core.sync.RequestBody;
  import software.amazon.awssdk.services.s3.S3Client;
  import software.amazon.awssdk.services.s3.model.PutObjectRequest;
  import software.amazon.awssdk.services.s3.model.PutObjectResponse;

  import static org.assertj.core.api.Assertions.assertThat;
  import static org.mockito.ArgumentMatchers.any;
  import static org.mockito.Mockito.when;

  class PhotoUploadTest extends BaseIntegrationTest {

      private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

      @Autowired private TestRestTemplate restTemplate;
      @Autowired private JwtService jwtService;
      @Autowired private UserRepository userRepository;
      @Autowired private DisplayRepository displayRepository;
      @Autowired private DisplayPhotoRepository displayPhotoRepository;

      @MockBean
      private S3Client s3Client;

      @AfterEach
      void cleanUp() {
          displayPhotoRepository.deleteAll();
          displayRepository.deleteAll();
          userRepository.deleteAll();
      }

      @Test
      void uploadPhoto_returns200AndIncrementsPhotoCount() {
          when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
              .thenReturn(PutObjectResponse.builder().build());

          User user = userRepository.save(User.builder()
              .provider("google").providerId("g1").email("photo@test.com")
              .name("Photo User").role(UserRole.USER).build());

          var loc = GF.createPoint(new Coordinate(-122.3321, 47.6062));
          loc.setSRID(4326);
          Display display = displayRepository.save(Display.builder()
              .user(user).title("Photo Display").location(loc).build());

          HttpHeaders headers = new HttpHeaders();
          headers.add("Cookie", "jwt=" + jwtService.generateToken(user));
          headers.setContentType(MediaType.MULTIPART_FORM_DATA);

          MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
          ByteArrayResource fileResource = new ByteArrayResource("fake image bytes".getBytes()) {
              @Override public String getFilename() { return "test.jpg"; }
          };
          body.add("file", fileResource);

          ResponseEntity<String> response = restTemplate.exchange(
              "/api/v1/displays/" + display.getId() + "/photos",
              HttpMethod.POST,
              new HttpEntity<>(body, headers),
              String.class);

          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
          assertThat(response.getBody()).contains("\"url\"");
          assertThat(response.getBody()).contains("\"success\":true");

          Display updated = displayRepository.findById(display.getId()).orElseThrow();
          assertThat(updated.getPhotoCount()).isEqualTo(1);
      }
  }
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd backend && ./mvnw test -Dtest=PhotoUploadTest -q 2>&1 | tail -5
  ```

  Expected: error — endpoint doesn't exist.

- [ ] **Step 3: Create PhotoService.java**

  The URL is constructed as `{endpoint}/{bucket}/{key}`. The first photo uploaded to a display is automatically set as primary (`isPrimary=true`). DB trigger handles `photo_count` increment.

  ```java
  package com.christmaslightmap.service;

  import com.christmaslightmap.dto.response.PhotoResponse;
  import com.christmaslightmap.model.DisplayPhoto;
  import com.christmaslightmap.repository.DisplayPhotoRepository;
  import com.christmaslightmap.repository.DisplayRepository;
  import com.christmaslightmap.repository.UserRepository;
  import lombok.RequiredArgsConstructor;
  import org.springframework.beans.factory.annotation.Value;
  import org.springframework.http.HttpStatus;
  import org.springframework.stereotype.Service;
  import org.springframework.transaction.annotation.Transactional;
  import org.springframework.web.multipart.MultipartFile;
  import org.springframework.web.server.ResponseStatusException;
  import software.amazon.awssdk.core.sync.RequestBody;
  import software.amazon.awssdk.services.s3.S3Client;
  import software.amazon.awssdk.services.s3.model.PutObjectRequest;

  import java.io.IOException;
  import java.util.UUID;

  @Service
  @RequiredArgsConstructor
  public class PhotoService {

      private final S3Client s3Client;
      private final DisplayRepository displayRepository;
      private final DisplayPhotoRepository displayPhotoRepository;
      private final UserRepository userRepository;

      @Value("${app.r2.bucket}")
      private String bucket;

      @Value("${app.r2.endpoint}")
      private String endpoint;

      @Transactional
      public PhotoResponse uploadPhoto(Long displayId, Long userId, MultipartFile file) {
          var display = displayRepository.findById(displayId)
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Display not found"));
          var user = userRepository.findById(userId)
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

          String extension = getExtension(file.getOriginalFilename());
          String key = "displays/" + displayId + "/" + UUID.randomUUID() + extension;

          try {
              s3Client.putObject(
                  PutObjectRequest.builder()
                      .bucket(bucket)
                      .key(key)
                      .contentType(file.getContentType())
                      .build(),
                  RequestBody.fromBytes(file.getBytes())
              );
          } catch (IOException e) {
              throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "File upload failed");
          }

          String url = endpoint + "/" + bucket + "/" + key;
          boolean isPrimary = display.getPhotoCount() == 0;

          DisplayPhoto photo = displayPhotoRepository.save(DisplayPhoto.builder()
              .display(display)
              .user(user)
              .url(url)
              .isPrimary(isPrimary)
              .build());

          return PhotoResponse.from(photo);
      }

      private String getExtension(String filename) {
          if (filename == null || !filename.contains(".")) return "";
          return filename.substring(filename.lastIndexOf("."));
      }
  }
  ```

- [ ] **Step 4: Add photo upload endpoint to DisplayController.java**

  Add field:
  ```java
  private final PhotoService photoService;
  ```

  Add method:
  ```java
  @PostMapping("/{id}/photos")
  public ResponseEntity<ApiResponse<PhotoResponse>> uploadPhoto(
      @PathVariable Long id,
      @RequestParam("file") MultipartFile file,
      Authentication authentication
  ) {
      Long userId = (Long) authentication.getPrincipal();
      return ResponseEntity.ok(ApiResponse.success(photoService.uploadPhoto(id, userId, file)));
  }
  ```

  Also add the import at the top of DisplayController:
  ```java
  import com.christmaslightmap.dto.response.PhotoResponse;
  import org.springframework.web.multipart.MultipartFile;
  ```

- [ ] **Step 5: Run PhotoUploadTest — confirm it passes**

  ```bash
  cd backend && ./mvnw test -Dtest=PhotoUploadTest -q 2>&1 | tail -5
  ```

  Expected: `Tests run: 1, Failures: 0, Errors: 0`

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/service/PhotoService.java \
           backend/src/main/java/com/christmaslightmap/controller/DisplayController.java \
           backend/src/test/java/com/christmaslightmap/PhotoUploadTest.java
  git commit -m "feat: add PhotoService and photo upload endpoint (POST /displays/:id/photos) with R2 storage"
  ```

---

## Task 7: ReportService + Report Endpoint + ReportTest

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/service/ReportService.java`
- Modify: `backend/src/main/java/com/christmaslightmap/controller/DisplayController.java`
- Create: `backend/src/test/java/com/christmaslightmap/ReportTest.java`

- [ ] **Step 1: Write the failing ReportTest**

  ```java
  package com.christmaslightmap;

  import com.christmaslightmap.dto.request.ReportRequest;
  import com.christmaslightmap.model.*;
  import com.christmaslightmap.repository.*;
  import com.christmaslightmap.security.JwtService;
  import org.junit.jupiter.api.AfterEach;
  import org.junit.jupiter.api.Test;
  import org.locationtech.jts.geom.Coordinate;
  import org.locationtech.jts.geom.GeometryFactory;
  import org.locationtech.jts.geom.PrecisionModel;
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.boot.test.web.client.TestRestTemplate;
  import org.springframework.http.*;

  import static org.assertj.core.api.Assertions.assertThat;

  class ReportTest extends BaseIntegrationTest {

      private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

      @Autowired private TestRestTemplate restTemplate;
      @Autowired private JwtService jwtService;
      @Autowired private UserRepository userRepository;
      @Autowired private DisplayRepository displayRepository;
      @Autowired private ReportRepository reportRepository;

      @AfterEach
      void cleanUp() {
          reportRepository.deleteAll();
          displayRepository.deleteAll();
          userRepository.deleteAll();
      }

      @Test
      void createReport_savesOpenReportInDB() {
          User user = userRepository.save(User.builder()
              .provider("google").providerId("g1").email("reporter@test.com")
              .name("Reporter").role(UserRole.USER).build());

          var loc = GF.createPoint(new Coordinate(-122.3321, 47.6062));
          loc.setSRID(4326);
          Display display = displayRepository.save(Display.builder()
              .user(user).title("Reported Display").location(loc).build());

          HttpHeaders headers = new HttpHeaders();
          headers.add("Cookie", "jwt=" + jwtService.generateToken(user));
          headers.setContentType(MediaType.APPLICATION_JSON);

          ReportRequest body = new ReportRequest();
          body.setReason(ReportReason.SPAM);
          body.setNotes("This looks fake");

          ResponseEntity<String> response = restTemplate.exchange(
              "/api/v1/displays/" + display.getId() + "/report",
              HttpMethod.POST,
              new HttpEntity<>(body, headers),
              String.class);

          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

          var reports = reportRepository.findAll();
          assertThat(reports).hasSize(1);
          assertThat(reports.get(0).getStatus()).isEqualTo(ReportStatus.OPEN);
          assertThat(reports.get(0).getReason()).isEqualTo(ReportReason.SPAM);
      }
  }
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd backend && ./mvnw test -Dtest=ReportTest -q 2>&1 | tail -5
  ```

  Expected: error — endpoint missing.

- [ ] **Step 3: Create ReportService.java**

  ```java
  package com.christmaslightmap.service;

  import com.christmaslightmap.dto.request.ReportRequest;
  import com.christmaslightmap.model.Report;
  import com.christmaslightmap.model.ReportStatus;
  import com.christmaslightmap.repository.DisplayRepository;
  import com.christmaslightmap.repository.ReportRepository;
  import com.christmaslightmap.repository.UserRepository;
  import lombok.RequiredArgsConstructor;
  import org.springframework.http.HttpStatus;
  import org.springframework.stereotype.Service;
  import org.springframework.transaction.annotation.Transactional;
  import org.springframework.web.server.ResponseStatusException;

  @Service
  @RequiredArgsConstructor
  public class ReportService {

      private final ReportRepository reportRepository;
      private final DisplayRepository displayRepository;
      private final UserRepository userRepository;

      @Transactional
      public void createReport(Long userId, Long displayId, ReportRequest request) {
          var display = displayRepository.findById(displayId)
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Display not found"));
          var user = userRepository.findById(userId)
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

          reportRepository.save(Report.builder()
              .display(display)
              .user(user)
              .reason(request.getReason())
              .notes(request.getNotes())
              .status(ReportStatus.OPEN)
              .build());
      }
  }
  ```

- [ ] **Step 4: Add report endpoint to DisplayController.java**

  Add field:
  ```java
  private final ReportService reportService;
  ```

  Add method:
  ```java
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
  ```

  Add import:
  ```java
  import com.christmaslightmap.dto.request.ReportRequest;
  import com.christmaslightmap.service.ReportService;
  ```

- [ ] **Step 5: Run ReportTest — confirm it passes**

  ```bash
  cd backend && ./mvnw test -Dtest=ReportTest -q 2>&1 | tail -5
  ```

  Expected: `Tests run: 1, Failures: 0, Errors: 0`

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/service/ReportService.java \
           backend/src/main/java/com/christmaslightmap/controller/DisplayController.java \
           backend/src/test/java/com/christmaslightmap/ReportTest.java
  git commit -m "feat: add ReportService and report endpoint (POST /displays/:id/report)"
  ```

---

## Task 8: AdminService + AdminController

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/service/AdminService.java`
- Create: `backend/src/main/java/com/christmaslightmap/controller/AdminController.java`

- [ ] **Step 1: Create AdminService.java**

  ```java
  package com.christmaslightmap.service;

  import com.christmaslightmap.dto.request.UpdateReportRequest;
  import com.christmaslightmap.dto.response.PagedResponse;
  import com.christmaslightmap.dto.response.ReportResponse;
  import com.christmaslightmap.model.ReportStatus;
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
  import java.util.stream.Collectors;

  @Service
  @RequiredArgsConstructor
  @Transactional(readOnly = true)
  public class AdminService {

      private final ReportRepository reportRepository;

      public PagedResponse<ReportResponse> getReports(ReportStatus status, int page, int size) {
          var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
          Page<com.christmaslightmap.model.Report> reports = (status != null)
              ? reportRepository.findByStatus(status, pageable)
              : reportRepository.findAll(pageable);

          List<ReportResponse> content = reports.getContent().stream()
              .map(ReportResponse::from)
              .collect(Collectors.toList());

          return PagedResponse.<ReportResponse>builder()
              .content(content)
              .page(page)
              .size(size)
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
  }
  ```

- [ ] **Step 2: Create AdminController.java**

  `@PreAuthorize("hasRole('ADMIN')")` at the class level blocks all methods for non-admin users. The `SecurityConfig` also blocks `/api/v1/admin/**` at the filter chain level — this is defense in depth.

  ```java
  package com.christmaslightmap.controller;

  import com.christmaslightmap.dto.request.UpdateReportRequest;
  import com.christmaslightmap.dto.response.ApiResponse;
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
  }
  ```

- [ ] **Step 3: Run full test suite**

  ```bash
  cd backend && ./mvnw test -q 2>&1 | tail -10
  ```

  Expected:
  ```
  Tests run: 16, Failures: 0, Errors: 0, Skipped: 0
  BUILD SUCCESS
  ```
  (3 AuthControllerTest + 2 DisplaySearchTest + 3 UpvoteTest + 1 PhotoUploadTest + 1 ReportTest + 1 ChristmasLightMapApplicationTests + 6 JwtServiceTest = 17 total — adjust count if it differs)

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/service/AdminService.java \
           backend/src/main/java/com/christmaslightmap/controller/AdminController.java
  git commit -m "feat: add AdminService and AdminController (GET/PATCH /api/v1/admin/reports)"
  ```

---

## Summary

This plan produces a fully functional backend with all API endpoints:

| Method | Path | Auth |
|---|---|---|
| GET | /api/v1/displays/search | public |
| GET | /api/v1/displays/:id | public |
| POST | /api/v1/displays | required |
| POST | /api/v1/displays/:id/photos | required |
| POST | /api/v1/displays/:id/upvote | required |
| DELETE | /api/v1/displays/:id/upvote | required |
| POST | /api/v1/displays/:id/report | required |
| GET | /api/v1/tags | public |
| GET | /api/v1/admin/reports | admin |
| PATCH | /api/v1/admin/reports/:id | admin |

**Next:** Implement `docs/superpowers/plans/YYYY-MM-DD-frontend-foundation.md` (Plan 3).
