# Host Handle (Shareable URL) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every host a shareable URL (`eventmapster.com/host/smithfamily`) so they can link directly to a page showing all their events.

**Architecture:** Add a `handle` column to the `users` table (auto-generated at login, optional custom override). A new public `GET /api/v1/users/handle/{handle}` endpoint returns the host profile and listings. The frontend parses `/host/{handle}` on page load and navigates directly to the host profile. Hosts can edit their handle in the Profile page.

**Tech Stack:** Spring Boot 3.5 / JPA / Flyway (backend), Angular 17 standalone components / signals (frontend).

---

## File Map

| File | Change |
|---|---|
| `backend/src/main/resources/db/migration/V17__add_user_handle.sql` | Create: add handle column, backfill, unique index |
| `backend/src/main/java/com/christmaslightmap/model/User.java` | Modify: add `handle` field |
| `backend/src/main/java/com/christmaslightmap/dto/response/HostUserResponse.java` | Modify: add `handle` field |
| `backend/src/main/java/com/christmaslightmap/dto/response/ListingResponse.java` | Modify: add `submittedByHandle` field |
| `backend/src/main/java/com/christmaslightmap/repository/UserRepository.java` | Modify: add `findByHandle`, `existsByHandle`, `existsByHandleAndIdNot` |
| `backend/src/main/java/com/christmaslightmap/dto/request/UpdateHandleRequest.java` | Create: request DTO |
| `backend/src/main/java/com/christmaslightmap/service/UserService.java` | Modify: add `generateUniqueHandle`, `getHostListingsByHandle`, `updateHandle` |
| `backend/src/main/java/com/christmaslightmap/security/OAuth2UserService.java` | Modify: inject UserService, auto-set handle on login |
| `backend/src/main/java/com/christmaslightmap/controller/UserController.java` | Modify: add `GET /handle/{handle}`, `PATCH /me/handle` |
| `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java` | Modify: permit `GET /api/v1/users/handle/**` |
| `backend/src/test/java/com/christmaslightmap/HostHandleTest.java` | Create: integration tests |
| `frontend/src/app/models/listing.model.ts` | Modify: add `handle` to `HostUser`, `submittedByHandle` to `Listing` |
| `frontend/src/app/services/listing-api.service.ts` | Modify: add `getHostListingsByHandle`, `updateHandle` |
| `frontend/src/app/app.component.ts` | Modify: parse `/host/{handle}` on load, update `openHostProfile` URL |
| `frontend/src/app/shared/display-detail/display-detail.component.ts` | Modify: pass `submittedByHandle` in `onViewHost` |
| `frontend/src/app/pages/profile/profile.component.ts` | Modify: add handle edit section |

---

### Task 1: Flyway Migration — Add Handle Column

**Files:**
- Create: `backend/src/main/resources/db/migration/V17__add_user_handle.sql`

- [ ] **Step 1: Create the migration file**

```sql
ALTER TABLE users ADD COLUMN handle VARCHAR(30);

WITH slugs AS (
  SELECT id,
    CASE
      WHEN length(lower(regexp_replace(
        regexp_replace(coalesce(display_name, name, 'user'), '[^a-zA-Z0-9]+', '-', 'g'),
        '^-+|-+$', '', 'g'
      ))) < 3 THEN 'user-' || id::text
      ELSE substr(lower(regexp_replace(
        regexp_replace(coalesce(display_name, name, 'user'), '[^a-zA-Z0-9]+', '-', 'g'),
        '^-+|-+$', '', 'g'
      )), 1, 20)
    END AS slug
  FROM users
),
ranked AS (
  SELECT id, slug,
    row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
  FROM slugs
)
UPDATE users u
SET handle = CASE WHEN r.rn = 1 THEN r.slug ELSE r.slug || '-' || u.id::text END
FROM ranked r
WHERE u.id = r.id;

CREATE UNIQUE INDEX users_handle_unique ON users(handle) WHERE handle IS NOT NULL;
```

- [ ] **Step 2: Verify the migration runs**

From `backend/`:
```bash
export $(grep -v '^#' .env | xargs) && mvn flyway:info 2>&1 | tail -10
```
Expected: `V17__add_user_handle` listed as `Pending`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V17__add_user_handle.sql
git commit -m "feat: add handle column to users with backfill migration"
```

---

### Task 2: Backend Model Layer — User, HostUserResponse, ListingResponse

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/model/User.java`
- Modify: `backend/src/main/java/com/christmaslightmap/dto/response/HostUserResponse.java`
- Modify: `backend/src/main/java/com/christmaslightmap/dto/response/ListingResponse.java`

- [ ] **Step 1: Add `handle` field to `User.java`**

In `User.java`, after the `displayName` field (line 35), add:
```java
@Column(name = "handle", length = 30, unique = true)
private String handle;
```

The full `User.java` after change:
```java
package com.christmaslightmap.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String provider;

    @Column(name = "provider_id", nullable = false)
    private String providerId;

    @Column(nullable = false)
    private String email;

    private String name;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "display_name", length = 100)
    private String displayName;

    @Column(name = "handle", length = 30, unique = true)
    private String handle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private UserRole role = UserRole.USER;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
```

- [ ] **Step 2: Add `handle` to `HostUserResponse.java`**

Replace the file with:
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
    private String handle;

    public static HostUserResponse from(User user) {
        return HostUserResponse.builder()
            .id(user.getId())
            .name(user.getName())
            .displayName(user.getDisplayName())
            .avatarUrl(user.getAvatarUrl())
            .handle(user.getHandle())
            .build();
    }
}
```

- [ ] **Step 3: Add `submittedByHandle` to `ListingResponse.java`**

Add field after `submittedByAvatarUrl` (line 19):
```java
private String submittedByHandle;
```

In the `from()` method, add after `.submittedByAvatarUrl(listing.getUser().getAvatarUrl())` (line 51):
```java
.submittedByHandle(listing.getUser().getHandle())
```

- [ ] **Step 4: Verify the build compiles**

From `backend/`:
```bash
mvn compile -q 2>&1 | tail -5
```
Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/model/User.java \
        backend/src/main/java/com/christmaslightmap/dto/response/HostUserResponse.java \
        backend/src/main/java/com/christmaslightmap/dto/response/ListingResponse.java
git commit -m "feat: add handle field to User model and response DTOs"
```

---

### Task 3: UserRepository — New Query Methods

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/repository/UserRepository.java`

- [ ] **Step 1: Add the three new methods**

Replace the file with:
```java
package com.christmaslightmap.repository;

import com.christmaslightmap.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByProviderAndProviderId(String provider, String providerId);

    Optional<User> findByHandle(String handle);

    boolean existsByHandle(String handle);

    boolean existsByHandleAndIdNot(String handle, Long id);

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
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
mvn compile -q 2>&1 | tail -5
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/repository/UserRepository.java
git commit -m "feat: add findByHandle, existsByHandle methods to UserRepository"
```

---

### Task 4: UpdateHandleRequest DTO

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/dto/request/UpdateHandleRequest.java`

- [ ] **Step 1: Create the DTO**

```java
package com.christmaslightmap.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateHandleRequest {

    @NotBlank
    @Size(min = 3, max = 30, message = "Handle must be 3-30 characters")
    @Pattern(regexp = "^[a-z0-9-]+$", message = "Handle must contain only lowercase letters, numbers, and hyphens")
    private String handle;
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
mvn compile -q 2>&1 | tail -5
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/dto/request/UpdateHandleRequest.java
git commit -m "feat: add UpdateHandleRequest DTO"
```

---

### Task 5: UserService — Handle Methods

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/service/UserService.java`

- [ ] **Step 1: Add the three new methods to `UserService.java`**

Add these methods after the `updateDisplayName` method (after line 93):

```java
public HostListingsResponse getHostListingsByHandle(String handle) {
    User user = userRepository.findByHandle(handle)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Host not found"));
    return getHostListings(user.getId());
}

@Transactional
public HostUserResponse updateHandle(Long userId, UpdateHandleRequest request) {
    if (userRepository.existsByHandleAndIdNot(request.getHandle(), userId)) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Handle already taken");
    }
    User user = userRepository.findById(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    user.setHandle(request.getHandle());
    return HostUserResponse.from(userRepository.save(user));
}

String generateUniqueHandle(String displayName, String fallbackName) {
    String source = (displayName != null && !displayName.isBlank()) ? displayName : fallbackName;
    if (source == null || source.isBlank()) source = "user";
    String slug = source.toLowerCase()
        .replaceAll("[^a-z0-9]+", "-")
        .replaceAll("^-+|-+$", "");
    if (slug.length() < 3) slug = "user-" + slug;
    if (slug.length() > 20) slug = slug.substring(0, 20);
    if (!userRepository.existsByHandle(slug)) return slug;
    for (int i = 2; i <= 99; i++) {
        String candidate = slug + "-" + i;
        if (!userRepository.existsByHandle(candidate)) return candidate;
    }
    return slug + "-" + (System.currentTimeMillis() % 10000);
}
```

Also add the import at the top of the file (with the other imports):
```java
import com.christmaslightmap.dto.request.UpdateHandleRequest;
```

- [ ] **Step 2: Verify the build compiles**

```bash
mvn compile -q 2>&1 | tail -5
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/service/UserService.java
git commit -m "feat: add handle service methods to UserService"
```

---

### Task 6: OAuth2UserService — Auto-Generate Handle on Login

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/security/OAuth2UserService.java`

The `OAuth2UserService` currently injects `UserRepository` directly. Change it to inject `UserService` instead (which itself uses `UserRepository`), then call `generateUniqueHandle` when creating a new user or when an existing user has no handle.

- [ ] **Step 1: Replace `OAuth2UserService.java`**

```java
package com.christmaslightmap.security;

import com.christmaslightmap.model.User;
import com.christmaslightmap.model.UserRole;
import com.christmaslightmap.repository.UserRepository;
import com.christmaslightmap.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class OAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final UserService userService;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oauth2User = super.loadUser(userRequest);
        String registrationId = userRequest.getClientRegistration().getRegistrationId();

        String providerId;
        String email;
        String name;
        String avatarUrl;

        if ("google".equals(registrationId)) {
            providerId = oauth2User.getAttribute("sub");
            email = oauth2User.getAttribute("email");
            name = oauth2User.getAttribute("name");
            avatarUrl = oauth2User.getAttribute("picture");
        } else if ("facebook".equals(registrationId)) {
            providerId = oauth2User.getAttribute("id");
            email = oauth2User.getAttribute("email");
            name = oauth2User.getAttribute("name");
            Map<String, Object> picture = oauth2User.getAttribute("picture");
            @SuppressWarnings("unchecked")
            Map<String, Object> pictureData = picture != null ? (Map<String, Object>) picture.get("data") : null;
            avatarUrl = pictureData != null ? (String) pictureData.get("url") : null;
        } else {
            throw new OAuth2AuthenticationException("Unsupported provider: " + registrationId);
        }

        String finalEmail = email;
        String finalName = name;
        String finalAvatarUrl = avatarUrl;

        User user = userRepository.findByProviderAndProviderId(registrationId, providerId)
            .map(existing -> {
                existing.setEmail(finalEmail);
                existing.setName(finalName);
                existing.setAvatarUrl(finalAvatarUrl);
                if (existing.getHandle() == null) {
                    existing.setHandle(userService.generateUniqueHandle(existing.getDisplayName(), finalName));
                }
                return userRepository.save(existing);
            })
            .orElseGet(() -> {
                String handle = userService.generateUniqueHandle(null, finalName);
                return userRepository.save(User.builder()
                    .provider(registrationId)
                    .providerId(providerId)
                    .email(finalEmail)
                    .name(finalName)
                    .avatarUrl(finalAvatarUrl)
                    .handle(handle)
                    .role(UserRole.USER)
                    .build());
            });

        return new CustomOAuth2User(oauth2User, user);
    }
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
mvn compile -q 2>&1 | tail -5
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/security/OAuth2UserService.java
git commit -m "feat: auto-generate handle for users on OAuth2 login"
```

---

### Task 7: UserController + SecurityConfig

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/controller/UserController.java`
- Modify: `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java`

- [ ] **Step 1: Add new endpoints to `UserController.java`**

Replace the file with:
```java
package com.christmaslightmap.controller;

import com.christmaslightmap.dto.request.UpdateDisplayNameRequest;
import com.christmaslightmap.dto.request.UpdateHandleRequest;
import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.HostListingsResponse;
import com.christmaslightmap.dto.response.HostUserResponse;
import com.christmaslightmap.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/{userId}/listings")
    public ResponseEntity<ApiResponse<HostListingsResponse>> getHostListings(@PathVariable Long userId) {
        return ResponseEntity.ok(ApiResponse.success(userService.getHostListings(userId)));
    }

    @GetMapping("/handle/{handle}")
    public ResponseEntity<ApiResponse<HostListingsResponse>> getHostByHandle(@PathVariable String handle) {
        return ResponseEntity.ok(ApiResponse.success(userService.getHostListingsByHandle(handle)));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<HostUserResponse>>> searchHosts(
        @RequestParam String q
    ) {
        return ResponseEntity.ok(ApiResponse.success(userService.searchHosts(q)));
    }

    @PatchMapping("/me")
    public ResponseEntity<ApiResponse<HostUserResponse>> updateDisplayName(
        @RequestBody UpdateDisplayNameRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(userService.updateDisplayName(userId, request)));
    }

    @PatchMapping("/me/handle")
    public ResponseEntity<ApiResponse<HostUserResponse>> updateHandle(
        @Valid @RequestBody UpdateHandleRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(userService.updateHandle(userId, request)));
    }
}
```

- [ ] **Step 2: Add public access rule in `SecurityConfig.java`**

In `SecurityConfig.java`, find the `authorizeHttpRequests` block. After line 50 (`.requestMatchers(HttpMethod.GET, "/api/v1/users/*/listings").permitAll()`), add:
```java
.requestMatchers(HttpMethod.GET, "/api/v1/users/handle/**").permitAll()
```

- [ ] **Step 3: Verify the build compiles**

```bash
mvn compile -q 2>&1 | tail -5
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/controller/UserController.java \
        backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java
git commit -m "feat: add GET /handle/{handle} and PATCH /me/handle endpoints"
```

---

### Task 8: Backend Integration Tests

**Files:**
- Create: `backend/src/test/java/com/christmaslightmap/HostHandleTest.java`

- [ ] **Step 1: Write the test file**

```java
package com.christmaslightmap;

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
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class HostHandleTest extends BaseIntegrationTest {

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

    @Test
    void getHostByHandle_returnsHostAndListings() {
        User host = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-handle1")
            .email("handle@test.com").name("Handle Host")
            .handle("handle-host")
            .role(UserRole.USER).build());

        listingRepository.save(Listing.builder()
            .user(host).title("Handle Event")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/handle/handle-host", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Handle Host");
        assertThat(response.getBody()).contains("handle-host");
        assertThat(response.getBody()).contains("Handle Event");
    }

    @Test
    void getHostByHandle_returns404ForUnknownHandle() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/handle/nonexistent-handle", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void updateHandle_succeeds() {
        User user = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-handle2")
            .email("update@test.com").name("Update User")
            .handle("old-handle")
            .role(UserRole.USER).build());

        HttpEntity<Map<String, String>> request = new HttpEntity<>(
            Map.of("handle", "new-handle"),
            authHeaders(user)
        );

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/users/me/handle", HttpMethod.PATCH, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("new-handle");

        User updated = userRepository.findById(user.getId()).orElseThrow();
        assertThat(updated.getHandle()).isEqualTo("new-handle");
    }

    @Test
    void updateHandle_returns409WhenHandleTaken() {
        userRepository.save(User.builder()
            .provider("facebook").providerId("fb-handle3")
            .email("taken@test.com").name("Taken User")
            .handle("taken-handle")
            .role(UserRole.USER).build());

        User user = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-handle4")
            .email("clash@test.com").name("Clash User")
            .handle("my-handle")
            .role(UserRole.USER).build());

        HttpEntity<Map<String, String>> request = new HttpEntity<>(
            Map.of("handle", "taken-handle"),
            authHeaders(user)
        );

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/users/me/handle", HttpMethod.PATCH, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void updateHandle_returns400ForInvalidFormat() {
        User user = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-handle5")
            .email("invalid@test.com").name("Invalid User")
            .handle("valid-handle")
            .role(UserRole.USER).build());

        HttpEntity<Map<String, String>> request = new HttpEntity<>(
            Map.of("handle", "UPPERCASE_INVALID!"),
            authHeaders(user)
        );

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/users/me/handle", HttpMethod.PATCH, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void getHostByHandle_isPublicNoAuthRequired() {
        userRepository.save(User.builder()
            .provider("facebook").providerId("fb-handle6")
            .email("public@test.com").name("Public Host")
            .handle("public-host")
            .role(UserRole.USER).build());

        // No auth headers — should still work
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/handle/public-host", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
```

- [ ] **Step 2: Run the tests**

From `backend/`:
```bash
export $(grep -v '^#' .env | xargs) && mvn test -pl . -Dtest=HostHandleTest -q 2>&1 | tail -15
```
Expected: `Tests run: 5, Failures: 0, Errors: 0`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/com/christmaslightmap/HostHandleTest.java
git commit -m "test: add integration tests for host handle endpoints"
```

---

### Task 9: Frontend — listing.model.ts + listing-api.service.ts

**Files:**
- Modify: `frontend/src/app/models/listing.model.ts`
- Modify: `frontend/src/app/services/listing-api.service.ts`

- [ ] **Step 1: Add `handle` to `HostUser` in `listing.model.ts`**

Find the `HostUser` interface (around line 101) and replace it:
```typescript
export interface HostUser {
  id: number;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  handle: string | null;
}
```

- [ ] **Step 2: Add `submittedByHandle` to `Listing` interface**

Find the `Listing` interface (around line 67). After `submittedByAvatarUrl: string | null;` add:
```typescript
submittedByHandle: string | null;
```

- [ ] **Step 3: Add `getHostListingsByHandle` and `updateHandle` to `listing-api.service.ts`**

After the existing `getHostListings` method (around line 88), add:
```typescript
getHostListingsByHandle(handle: string): Observable<HostListingsResponse> {
  return this.http.get<ApiResponse<HostListingsResponse>>(
    `${this.base}/users/handle/${handle}`, { withCredentials: true }
  ).pipe(map(r => r.data));
}
```

After the existing `updateDisplayName` method (around line 100), add:
```typescript
updateHandle(handle: string): Observable<HostSearchResult> {
  return this.http.patch<ApiResponse<HostSearchResult>>(
    `${this.base}/users/me/handle`, { handle }, { withCredentials: true }
  ).pipe(map(r => r.data));
}
```

- [ ] **Step 4: Verify the build compiles**

From `frontend/`:
```bash
npm run build 2>&1 | tail -6
```
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/models/listing.model.ts \
        frontend/src/app/services/listing-api.service.ts
git commit -m "feat: add handle fields to frontend models and API service"
```

---

### Task 10: Frontend — app.component + display-detail URL Wiring

**Files:**
- Modify: `frontend/src/app/app.component.ts`
- Modify: `frontend/src/app/shared/display-detail/display-detail.component.ts`

**Context:** `app.component.ts` manages all screen navigation and owns the URL. Currently `ngOnInit` parses `/host` and redirects to `/`. We need to parse `/host/{handle}`, fetch the host, and navigate to the host screen. `openHostProfile` currently sets URL to `/host` — it needs `/host/{handle}`.

`display-detail.component.ts` builds a `HostUser` object in `onViewHost()` — needs to pass `submittedByHandle`.

- [ ] **Step 1: Update `ngOnInit` in `app.component.ts` to parse `/host/{handle}`**

Find this block in `ngOnInit` (around line 200):
```typescript
else if (path.startsWith('/hosts')) this.location.replaceState('/');
else if (path.startsWith('/host')) this.location.replaceState('/');
```

Replace with:
```typescript
else if (path.startsWith('/hosts')) this.location.replaceState('/');
else if (path.startsWith('/host/')) {
  const handle = path.split('/')[2];
  if (handle) {
    this.listingApi.getHostListingsByHandle(handle).subscribe({
      next: resp => {
        this.viewingHost.set({ id: resp.user.id, name: resp.user.name, displayName: resp.user.displayName, avatarUrl: resp.user.avatarUrl, handle: resp.user.handle ?? null });
        this.screen.set('host');
      },
      error: () => this.location.replaceState('/'),
    });
  }
}
```

`ListingApiService` is not yet in `app.component.ts`. Add the import at the top of the file with the other service imports:
```typescript
import { ListingApiService } from './services/listing-api.service';
```

Then add the field injection in the class body after the existing `inject()` calls (near `authService` and `upvoteService`):
```typescript
private listingApi = inject(ListingApiService);
```

- [ ] **Step 2: Update `openHostProfile` to use handle in URL**

Find `openHostProfile` (around line 237):
```typescript
openHostProfile(host: HostUser) {
  this.selectedDisplay.set(null);
  this.viewingHost.set(host);
  this.screen.set('host');
  this.location.replaceState('/host');
}
```

Replace with:
```typescript
openHostProfile(host: HostUser) {
  this.selectedDisplay.set(null);
  this.viewingHost.set(host);
  this.screen.set('host');
  this.location.replaceState('/host/' + (host.handle ?? host.id));
}
```

- [ ] **Step 3: Update `onViewHost` in `display-detail.component.ts`**

Find `onViewHost` (around line 191):
```typescript
onViewHost() {
  const d = this.fullDisplay();
  if (!d) return;
  this.viewHost.emit({ id: d.submittedBy, name: d.submittedByName, displayName: null, avatarUrl: d.submittedByAvatarUrl });
}
```

Replace with:
```typescript
onViewHost() {
  const d = this.fullDisplay();
  if (!d) return;
  this.viewHost.emit({ id: d.submittedBy, name: d.submittedByName, displayName: null, avatarUrl: d.submittedByAvatarUrl, handle: d.submittedByHandle ?? null });
}
```

- [ ] **Step 4: Verify the build compiles**

From `frontend/`:
```bash
npm run build 2>&1 | tail -6
```
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/app.component.ts \
        frontend/src/app/shared/display-detail/display-detail.component.ts
git commit -m "feat: wire host handle into URL navigation and event detail modal"
```

---

### Task 11: Profile Page — Handle Edit Section

**Files:**
- Modify: `frontend/src/app/pages/profile/profile.component.ts`

**Context:** The profile page already has a "Business / host name" section with an input + save button (around lines 44–67). Add a similar "Profile URL handle" section directly below it. Pattern: signal for current value, saving state, saved feedback, call `updateHandle()`.

- [ ] **Step 1: Add handle signals to the class**

In `profile.component.ts`, find the class body. After the existing `displayName`, `savingDisplayName`, `displayNameSaved` signals, add:

```typescript
handle = signal('');
savingHandle = signal(false);
handleSaved = signal(false);
handleError = signal('');
```

- [ ] **Step 2: Load the handle on init**

In `ngOnInit`, after loading the display name, load the handle from the user. The `user` input is a `User` object which doesn't have `handle`. We need to fetch it from the API.

Actually the current auth flow returns the user from `AuthService`. Check if `User` model now has handle. Since `User` interface is the auth user (not `HostUser`), it doesn't have handle. The cleanest approach: call `getHostListings(user.id)` on init and extract the handle from the response user.

In `ngOnInit`, add after the existing load calls:
```typescript
if (this.user) {
  this.listingApi.getHostListings(this.user.id).subscribe({
    next: resp => this.handle.set(resp.user.handle ?? ''),
  });
}
```

- [ ] **Step 3: Add `saveHandle` method**

```typescript
saveHandle() {
  const h = this.handle().trim().toLowerCase();
  if (!h || h.length < 3) return;
  this.savingHandle.set(true);
  this.handleError.set('');
  this.listingApi.updateHandle(h).subscribe({
    next: () => {
      this.savingHandle.set(false);
      this.handleSaved.set(true);
      this.handle.set(h);
      setTimeout(() => this.handleSaved.set(false), 2000);
    },
    error: (err) => {
      this.savingHandle.set(false);
      this.handleError.set(err.status === 409 ? 'That handle is already taken.' : 'Something went wrong.');
    },
  });
}
```

- [ ] **Step 4: Add the handle edit section to the template**

After the closing `</div>` of the "Business / host name" section (after line 67), add:

```html
        <!-- Handle / profile URL -->
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.06)">
          <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">
            Profile URL handle
          </div>
          <div style="font-size:12.5px;color:#64748b;margin-bottom:12px">
            Share <strong style="color:#0f172a">eventmapster.com/host/{{handle() || 'yourhandle'}}</strong> to link people directly to your events.
          </div>
          <div style="display:flex;gap:8px">
            <input [ngModel]="handle()"
                   (ngModelChange)="handle.set($event)"
                   placeholder="e.g. smithfamilylights"
                   style="flex:1;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                          font-size:13.5px;color:#0f172a;outline:none;background:white"/>
            <button (click)="saveHandle()"
                    [disabled]="savingHandle()"
                    [style.opacity]="savingHandle() ? '0.6' : '1'"
                    style="padding:9px 16px;background:var(--accent);color:white;border:none;
                           border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">
              {{savingHandle() ? 'Saving…' : handleSaved() ? 'Saved!' : 'Save'}}
            </button>
          </div>
          <div *ngIf="handleError()"
               style="font-size:12px;color:#ef4444;margin-top:6px">
            {{handleError()}}
          </div>
        </div>
```

- [ ] **Step 5: Verify the build compiles**

From `frontend/`:
```bash
npm run build 2>&1 | tail -6
```
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/pages/profile/profile.component.ts
git commit -m "feat: add handle edit section to profile page"
```

---

### Final Step: Push to Production

```bash
git push origin main
```
