# Host Entity & Ownership Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a first-class `Host` entity so any user can create and manage named host profiles, submit listings under them, and transfer full ownership to another user instantly.

**Architecture:** A new `hosts` table holds each host identity (handle, displayName, avatarUrl, ownerUserId). `listings` gains a nullable `host_id` FK — existing listings are unaffected. Edit permission checks host ownership when `host_id` is set, so transfer is a single `owner_user_id` update with no listing changes. The existing `/host/{handle}` URL resolves hosts before users for backward compat.

**Tech Stack:** Spring Boot 3.5 / JPA / Flyway / TestContainers (backend), Angular 17 signals / CommonModule (frontend), Cloudflare R2 (avatar upload), PostgreSQL + PostGIS

---

## File Map

**New backend files:**
- `backend/src/main/resources/db/migration/V19__hosts_table.sql`
- `backend/src/main/resources/db/migration/V20__listings_host_id.sql`
- `backend/src/main/java/com/christmaslightmap/model/Host.java`
- `backend/src/main/java/com/christmaslightmap/repository/HostRepository.java`
- `backend/src/main/java/com/christmaslightmap/dto/request/CreateHostRequest.java`
- `backend/src/main/java/com/christmaslightmap/dto/request/UpdateHostRequest.java`
- `backend/src/main/java/com/christmaslightmap/dto/request/TransferHostRequest.java`
- `backend/src/main/java/com/christmaslightmap/dto/response/HostResponse.java`
- `backend/src/main/java/com/christmaslightmap/service/HostService.java`
- `backend/src/main/java/com/christmaslightmap/controller/HostController.java`
- `backend/src/test/java/com/christmaslightmap/HostEntityTest.java`

**Modified backend files:**
- `backend/src/main/java/com/christmaslightmap/model/Listing.java` — add `host` field
- `backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java` — add 2 derived queries
- `backend/src/main/java/com/christmaslightmap/dto/request/CreateListingRequest.java` — add `hostId`
- `backend/src/main/java/com/christmaslightmap/dto/request/UpdateListingRequest.java` — add `hostId`
- `backend/src/main/java/com/christmaslightmap/service/ListingService.java` — host ownership checks + buildSummary update
- `backend/src/main/java/com/christmaslightmap/service/UserService.java` — handle resolution fallback
- `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java` — permit host endpoints

**Modified frontend files:**
- `frontend/src/app/models/listing.model.ts` — add `HostEntity` interface, add `hostId` to request types
- `frontend/src/app/services/listing-api.service.ts` — add host CRUD + avatar upload methods
- `frontend/src/app/pages/profile/profile.component.ts` — add "Your Hosts" section
- `frontend/src/app/pages/submit/submit.component.ts` — add "Post as" field

---

### Task 1: DB Migrations

**Files:**
- Create: `backend/src/main/resources/db/migration/V19__hosts_table.sql`
- Create: `backend/src/main/resources/db/migration/V20__listings_host_id.sql`

- [ ] **Step 1: Create V19 migration**

```sql
-- backend/src/main/resources/db/migration/V19__hosts_table.sql
CREATE TABLE hosts (
    id          BIGSERIAL PRIMARY KEY,
    owner_user_id BIGINT NOT NULL REFERENCES users(id),
    handle      VARCHAR(30) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url  VARCHAR(500),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX hosts_handle_unique ON hosts(handle);
```

- [ ] **Step 2: Create V20 migration**

```sql
-- backend/src/main/resources/db/migration/V20__listings_host_id.sql
ALTER TABLE listings ADD COLUMN host_id BIGINT REFERENCES hosts(id);
```

- [ ] **Step 3: Verify migrations apply cleanly**

Run: `cd backend && export $(grep -v '^#' .env | xargs) && mvn spring-boot:run`

Expected: Application starts with no Flyway errors. Ctrl-C to stop.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V19__hosts_table.sql \
        backend/src/main/resources/db/migration/V20__listings_host_id.sql
git commit -m "feat: add hosts table and listings.host_id migrations"
```

---

### Task 2: Host Entity + HostRepository + ListingRepository additions

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/model/Host.java`
- Create: `backend/src/main/java/com/christmaslightmap/repository/HostRepository.java`
- Modify: `backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java`

- [ ] **Step 1: Create Host entity**

```java
// backend/src/main/java/com/christmaslightmap/model/Host.java
package com.christmaslightmap.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "hosts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Host {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 30)
    private String handle;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
```

- [ ] **Step 2: Create HostRepository**

```java
// backend/src/main/java/com/christmaslightmap/repository/HostRepository.java
package com.christmaslightmap.repository;

import com.christmaslightmap.model.Host;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HostRepository extends JpaRepository<Host, Long> {
    Optional<Host> findByHandle(String handle);
    boolean existsByHandle(String handle);
    boolean existsByHandleAndIdNot(String handle, Long id);
    List<Host> findByOwner_IdOrderByCreatedAtDesc(Long ownerId);
}
```

- [ ] **Step 3: Add two derived queries to ListingRepository**

In `backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java`, add after `findUpcomingByUserId`:

```java
boolean existsByHostIdAndIsActiveTrue(Long hostId);
int countByHostIdAndIsActiveTrue(Long hostId);
```

Also add a query to find upcoming listings by host (used in handle resolution):

```java
@Query("SELECT l FROM Listing l LEFT JOIN FETCH l.tags WHERE l.host.id = :hostId AND l.isActive = true AND l.endDatetime > :now ORDER BY l.startDatetime ASC")
List<Listing> findUpcomingByHostId(@Param("hostId") Long hostId, @Param("now") LocalDateTime now);
```

- [ ] **Step 4: Run tests to verify nothing broke**

Run: `cd backend && mvn test -q`
Expected: All existing tests pass (35/36 — the pre-existing logout_clearsCookie failure is unrelated).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/model/Host.java \
        backend/src/main/java/com/christmaslightmap/repository/HostRepository.java \
        backend/src/main/java/com/christmaslightmap/repository/ListingRepository.java
git commit -m "feat: add Host entity, HostRepository, and ListingRepository host queries"
```

---

### Task 3: Host DTOs + HostService

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/dto/request/CreateHostRequest.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/request/UpdateHostRequest.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/request/TransferHostRequest.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/HostResponse.java`
- Create: `backend/src/main/java/com/christmaslightmap/service/HostService.java`
- Test: `backend/src/test/java/com/christmaslightmap/HostEntityTest.java`

- [ ] **Step 1: Write the failing tests**

```java
// backend/src/test/java/com/christmaslightmap/HostEntityTest.java
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

class HostEntityTest extends BaseIntegrationTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private UserRepository userRepository;
    @Autowired private HostRepository hostRepository;
    @Autowired private ListingRepository listingRepository;
    @Autowired private JwtService jwtService;

    @AfterEach
    void cleanUp() {
        listingRepository.deleteAll();
        hostRepository.deleteAll();
        userRepository.deleteAll();
    }

    private HttpHeaders authHeaders(User user) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(user));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private User savedUser(String suffix) {
        return userRepository.save(User.builder()
            .provider("facebook").providerId("fb-host-" + suffix)
            .email(suffix + "@test.com").name("User " + suffix)
            .handle("user-" + suffix)
            .role(UserRole.USER).build());
    }

    private Point point(double lng, double lat) {
        Point p = GF.createPoint(new Coordinate(lng, lat));
        p.setSRID(4326);
        return p;
    }

    @Test
    void createHost_succeeds() {
        User user = savedUser("create1");
        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("displayName", "Clayton's BBQ", "handle", "claytons-bbq"),
            authHeaders(user));

        ResponseEntity<String> resp = restTemplate.postForEntity("/api/v1/hosts", req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).contains("claytons-bbq");
        assertThat(resp.getBody()).contains("Clayton's BBQ");
    }

    @Test
    void createHost_returns409WhenHandleTakenByUser() {
        User user = savedUser("create2");
        // user-create2 handle is already used by the user itself
        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("displayName", "Conflict Host", "handle", "user-create2"),
            authHeaders(user));

        ResponseEntity<String> resp = restTemplate.postForEntity("/api/v1/hosts", req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void createHost_returns409WhenHandleTakenByHost() {
        User user = savedUser("create3");
        hostRepository.save(Host.builder()
            .owner(user).handle("taken-host").displayName("Taken").build());

        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("displayName", "Another Host", "handle", "taken-host"),
            authHeaders(user));

        ResponseEntity<String> resp = restTemplate.postForEntity("/api/v1/hosts", req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void getMyHosts_returnsOwnedHosts() {
        User user = savedUser("list1");
        hostRepository.save(Host.builder()
            .owner(user).handle("my-truck").displayName("My Truck").build());

        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/me", HttpMethod.GET,
            new HttpEntity<>(authHeaders(user)), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains("my-truck");
    }

    @Test
    void updateHost_succeeds() {
        User user = savedUser("update1");
        Host host = hostRepository.save(Host.builder()
            .owner(user).handle("old-truck").displayName("Old Name").build());

        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("displayName", "New Name", "handle", "new-truck"),
            authHeaders(user));

        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/" + host.getId(), HttpMethod.PATCH, req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains("New Name");
        assertThat(resp.getBody()).contains("new-truck");
    }

    @Test
    void deleteHost_succeedsWhenNoActiveListings() {
        User user = savedUser("delete1");
        Host host = hostRepository.save(Host.builder()
            .owner(user).handle("del-truck").displayName("Del Truck").build());

        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/" + host.getId(), HttpMethod.DELETE,
            new HttpEntity<>(authHeaders(user)), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(hostRepository.findById(host.getId())).isEmpty();
    }

    @Test
    void transferHost_succeeds() {
        User owner = savedUser("transfer1");
        User recipient = savedUser("transfer2");
        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("transfer-truck").displayName("Transfer Truck").build());

        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("targetHandle", "user-transfer2"),
            authHeaders(owner));

        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/" + host.getId() + "/transfer",
            HttpMethod.POST, req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        Host updated = hostRepository.findById(host.getId()).orElseThrow();
        assertThat(updated.getOwner().getId()).isEqualTo(recipient.getId());
    }

    @Test
    void transferHost_returns400WhenTransferringToSelf() {
        User owner = savedUser("transfer3");
        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("self-truck").displayName("Self Truck").build());

        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("targetHandle", "user-transfer3"),
            authHeaders(owner));

        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/" + host.getId() + "/transfer",
            HttpMethod.POST, req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void transferHost_returns404WhenTargetHandleNotFound() {
        User owner = savedUser("transfer4");
        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("notfound-truck").displayName("Not Found Truck").build());

        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("targetHandle", "nonexistent-handle"),
            authHeaders(owner));

        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/" + host.getId() + "/transfer",
            HttpMethod.POST, req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void hostEndpoints_return401WhenUnauthenticated() {
        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/me", HttpMethod.GET,
            new HttpEntity<>(new HttpHeaders()), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && mvn test -Dtest=HostEntityTest -q`
Expected: FAIL — HostController and HostService do not exist yet.

- [ ] **Step 3: Create request/response DTOs**

```java
// backend/src/main/java/com/christmaslightmap/dto/request/CreateHostRequest.java
package com.christmaslightmap.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreateHostRequest {
    @NotBlank @Size(max = 100)
    private String displayName;

    @NotBlank @Size(min = 3, max = 30)
    @Pattern(regexp = "^[a-z0-9-]+$", message = "Handle may only contain lowercase letters, numbers, and hyphens")
    private String handle;
}
```

```java
// backend/src/main/java/com/christmaslightmap/dto/request/UpdateHostRequest.java
package com.christmaslightmap.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UpdateHostRequest {
    @Size(max = 100)
    private String displayName;

    @Size(min = 3, max = 30)
    @Pattern(regexp = "^[a-z0-9-]+$", message = "Handle may only contain lowercase letters, numbers, and hyphens")
    private String handle;
}
```

```java
// backend/src/main/java/com/christmaslightmap/dto/request/TransferHostRequest.java
package com.christmaslightmap.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TransferHostRequest {
    @NotBlank
    private String targetHandle;
}
```

```java
// backend/src/main/java/com/christmaslightmap/dto/response/HostResponse.java
package com.christmaslightmap.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class HostResponse {
    private Long id;
    private String handle;
    private String displayName;
    private String avatarUrl;
    private int listingCount;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 4: Create HostService**

```java
// backend/src/main/java/com/christmaslightmap/service/HostService.java
package com.christmaslightmap.service;

import com.christmaslightmap.dto.request.CreateHostRequest;
import com.christmaslightmap.dto.request.TransferHostRequest;
import com.christmaslightmap.dto.request.UpdateHostRequest;
import com.christmaslightmap.dto.response.HostResponse;
import com.christmaslightmap.model.Host;
import com.christmaslightmap.model.User;
import com.christmaslightmap.repository.HostRepository;
import com.christmaslightmap.repository.ListingRepository;
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
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HostService {

    private final HostRepository hostRepository;
    private final UserRepository userRepository;
    private final ListingRepository listingRepository;
    private final S3Client s3Client;

    @Value("${app.r2.bucket}")
    private String bucket;

    @Value("${app.r2.public-url}")
    private String publicUrl;

    @Transactional
    public HostResponse createHost(Long userId, CreateHostRequest request) {
        User owner = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (hostRepository.existsByHandle(request.getHandle())
                || userRepository.existsByHandle(request.getHandle())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Handle already taken");
        }

        Host host = hostRepository.save(Host.builder()
            .owner(owner)
            .handle(request.getHandle())
            .displayName(request.getDisplayName())
            .build());

        return toResponse(host);
    }

    public List<HostResponse> getMyHosts(Long userId) {
        return hostRepository.findByOwner_IdOrderByCreatedAtDesc(userId).stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    @Transactional
    public HostResponse updateHost(Long userId, Long hostId, UpdateHostRequest request) {
        Host host = findOwned(userId, hostId);

        if (request.getHandle() != null) {
            if (hostRepository.existsByHandleAndIdNot(request.getHandle(), hostId)
                    || userRepository.existsByHandle(request.getHandle())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Handle already taken");
            }
            host.setHandle(request.getHandle());
        }

        if (request.getDisplayName() != null) {
            host.setDisplayName(request.getDisplayName());
        }

        return toResponse(hostRepository.save(host));
    }

    @Transactional
    public void deleteHost(Long userId, Long hostId) {
        Host host = findOwned(userId, hostId);

        if (listingRepository.existsByHostIdAndIsActiveTrue(hostId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Remove all active listings before deleting");
        }

        hostRepository.delete(host);
    }

    @Transactional
    public void transferHost(Long userId, Long hostId, TransferHostRequest request) {
        Host host = findOwned(userId, hostId);

        User target = userRepository.findByHandle(request.getTargetHandle())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No user found with that handle"));

        if (target.getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You already own this host");
        }

        host.setOwner(target);
        hostRepository.save(host);
    }

    @Transactional
    public HostResponse uploadAvatar(Long userId, Long hostId, MultipartFile file) {
        Host host = findOwned(userId, hostId);

        String extension = getExtension(file.getOriginalFilename());
        String key = "hosts/" + hostId + "/avatar" + extension;

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

        host.setAvatarUrl(publicUrl + "/" + key);
        return toResponse(hostRepository.save(host));
    }

    private Host findOwned(Long userId, Long hostId) {
        Host host = hostRepository.findById(hostId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Host not found"));
        if (!host.getOwner().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your host");
        }
        return host;
    }

    private HostResponse toResponse(Host host) {
        return HostResponse.builder()
            .id(host.getId())
            .handle(host.getHandle())
            .displayName(host.getDisplayName())
            .avatarUrl(host.getAvatarUrl())
            .listingCount(listingRepository.countByHostIdAndIsActiveTrue(host.getId()))
            .createdAt(host.getCreatedAt())
            .build();
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf("."));
    }
}
```

- [ ] **Step 5: Commit DTOs + service (tests still failing — controller not yet created)**

```bash
git add backend/src/main/java/com/christmaslightmap/dto/request/CreateHostRequest.java \
        backend/src/main/java/com/christmaslightmap/dto/request/UpdateHostRequest.java \
        backend/src/main/java/com/christmaslightmap/dto/request/TransferHostRequest.java \
        backend/src/main/java/com/christmaslightmap/dto/response/HostResponse.java \
        backend/src/main/java/com/christmaslightmap/service/HostService.java \
        backend/src/test/java/com/christmaslightmap/HostEntityTest.java
git commit -m "feat: add Host DTOs, HostService, and HostEntityTest"
```

---

### Task 4: HostController + SecurityConfig

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/controller/HostController.java`
- Modify: `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java`

- [ ] **Step 1: Create HostController**

```java
// backend/src/main/java/com/christmaslightmap/controller/HostController.java
package com.christmaslightmap.controller;

import com.christmaslightmap.dto.request.CreateHostRequest;
import com.christmaslightmap.dto.request.TransferHostRequest;
import com.christmaslightmap.dto.request.UpdateHostRequest;
import com.christmaslightmap.dto.response.ApiResponse;
import com.christmaslightmap.dto.response.HostResponse;
import com.christmaslightmap.service.HostService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/hosts")
@RequiredArgsConstructor
public class HostController {

    private final HostService hostService;

    @PostMapping
    public ResponseEntity<ApiResponse<HostResponse>> createHost(
        @Valid @RequestBody CreateHostRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(hostService.createHost(userId, request)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<List<HostResponse>>> getMyHosts(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(hostService.getMyHosts(userId)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<HostResponse>> updateHost(
        @PathVariable Long id,
        @RequestBody UpdateHostRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(hostService.updateHost(userId, id, request)));
    }

    @PostMapping("/{id}/avatar")
    public ResponseEntity<ApiResponse<HostResponse>> uploadAvatar(
        @PathVariable Long id,
        @RequestParam("file") MultipartFile file,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.success(hostService.uploadAvatar(userId, id, file)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteHost(
        @PathVariable Long id,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        hostService.deleteHost(userId, id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{id}/transfer")
    public ResponseEntity<Void> transferHost(
        @PathVariable Long id,
        @RequestBody TransferHostRequest request,
        Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        hostService.transferHost(userId, id, request);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 2: Update SecurityConfig to allow host endpoints**

In `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java`, add these lines inside `authorizeHttpRequests`, just before `.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")`:

```java
.requestMatchers("/api/v1/hosts", "/api/v1/hosts/**").authenticated()
```

The full `authorizeHttpRequests` block should now be:

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
    .requestMatchers(HttpMethod.GET, "/api/v1/users/search").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/v1/users/*/listings").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/v1/users/handle/**").permitAll()
    .requestMatchers("/api/v1/hosts", "/api/v1/hosts/**").authenticated()
    .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
    .anyRequest().authenticated()
)
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `cd backend && mvn test -Dtest=HostEntityTest -q`
Expected: All 10 tests PASS (one per test method).

- [ ] **Step 4: Run full test suite**

Run: `cd backend && mvn test -q`
Expected: 35/36 pass (pre-existing logout_clearsCookie failure unrelated).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/controller/HostController.java \
        backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java
git commit -m "feat: add HostController and security rules for /api/v1/hosts"
```

---

### Task 5: Listing host_id support (backend)

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/model/Listing.java`
- Modify: `backend/src/main/java/com/christmaslightmap/dto/request/CreateListingRequest.java`
- Modify: `backend/src/main/java/com/christmaslightmap/dto/request/UpdateListingRequest.java`
- Modify: `backend/src/main/java/com/christmaslightmap/service/ListingService.java`

- [ ] **Step 1: Add host field to Listing.java**

In `backend/src/main/java/com/christmaslightmap/model/Listing.java`, add the following field after the `user` field (line 26):

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "host_id")
private Host host;
```

Also add `import com.christmaslightmap.model.Host;` if not already present (it's in the same package so no import needed).

- [ ] **Step 2: Add hostId to CreateListingRequest**

In `backend/src/main/java/com/christmaslightmap/dto/request/CreateListingRequest.java`, add after `private String hostName;`:

```java
private Long hostId;
```

- [ ] **Step 3: Add hostId to UpdateListingRequest**

In `backend/src/main/java/com/christmaslightmap/dto/request/UpdateListingRequest.java`, add after `private String hostName;` (wherever that field is — check the file):

```java
private Long hostId;
```

- [ ] **Step 4: Update ListingService — inject HostRepository**

In `backend/src/main/java/com/christmaslightmap/service/ListingService.java`:

Add `import com.christmaslightmap.repository.HostRepository;` to imports.

Add to the field declarations:

```java
private final HostRepository hostRepository;
```

- [ ] **Step 5: Update createListing to support hostId**

Replace the `createListing` method body in `ListingService.java`:

```java
@Transactional
public ListingResponse createListing(Long userId, CreateListingRequest request) {
    var user = userRepository.findById(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

    Host host = null;
    if (request.getHostId() != null) {
        host = hostRepository.findById(request.getHostId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Host not found"));
        if (!host.getOwner().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your host");
        }
    }

    Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(request.getLng(), request.getLat()));
    location.setSRID(4326);

    var tags = new HashSet<>(tagRepository.findAllById(
        request.getTagIds() != null ? request.getTagIds() : List.of()));

    String resolvedHostName = host != null ? host.getDisplayName()
        : (request.getHostName() != null && !request.getHostName().isBlank()
            ? request.getHostName().trim().substring(0, Math.min(request.getHostName().trim().length(), 100))
            : null);

    Listing listing = listingRepository.save(Listing.builder()
        .user(user)
        .host(host)
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
        .hostName(resolvedHostName)
        .tags(tags)
        .build());

    return ListingResponse.from(listing, List.of());
}
```

- [ ] **Step 6: Update updateListing and deleteListing permission checks**

Replace the ownership check in `updateListing` (find the line `if (!listing.getUser().getId().equals(userId))`):

```java
boolean isOwner = listing.getHost() != null
    ? listing.getHost().getOwner().getId().equals(userId)
    : listing.getUser().getId().equals(userId);
if (!isOwner) {
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
}
```

Apply the same replacement in `deleteListing` and `deletePhoto` (both have the identical `if (!listing.getUser().getId().equals(userId))` check).

- [ ] **Step 7: Update buildSummary to use host displayName**

Replace the `buildSummary` method's `resolvedHostName` computation:

```java
private ListingSummaryResponse buildSummary(Listing listing, String primaryPhotoUrl) {
    String resolvedHostName;
    if (listing.getHost() != null) {
        resolvedHostName = listing.getHost().getDisplayName();
    } else {
        String hostName = listing.getHostName();
        String displayName = listing.getUser().getDisplayName();
        String userName = listing.getUser().getName();
        resolvedHostName = hostName != null ? hostName : (displayName != null ? displayName : userName);
    }
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

- [ ] **Step 8: Add the delete-with-active-listings test to HostEntityTest**

Now that `Listing.host` exists, add this test to `backend/src/test/java/com/christmaslightmap/HostEntityTest.java`:

```java
@Test
void deleteHost_returns409WhenActiveListingsExist() {
    User user = savedUser("delete2");
    Host host = hostRepository.save(Host.builder()
        .owner(user).handle("busy-truck").displayName("Busy Truck").build());
    listingRepository.save(Listing.builder()
        .user(user).host(host).title("Active Event")
        .city("Austin").state("TX").location(point(-97.7, 30.2))
        .category(Category.FOOD_TRUCK)
        .startDatetime(LocalDateTime.now().plusDays(1))
        .endDatetime(LocalDateTime.now().plusDays(2))
        .build());

    ResponseEntity<String> resp = restTemplate.exchange(
        "/api/v1/hosts/" + host.getId(), HttpMethod.DELETE,
        new HttpEntity<>(authHeaders(user)), String.class);

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
}
```

Note: `point(double lng, double lat)` helper and `savedUser(String suffix)` are already defined in `HostEntityTest`. `Category` import is already present. Add `import com.christmaslightmap.model.Host;` if not already imported.

- [ ] **Step 9: Run full test suite**

Run: `cd backend && mvn test -q`
Expected: 35/36 pass.

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/model/Listing.java \
        backend/src/main/java/com/christmaslightmap/dto/request/CreateListingRequest.java \
        backend/src/main/java/com/christmaslightmap/dto/request/UpdateListingRequest.java \
        backend/src/main/java/com/christmaslightmap/service/ListingService.java \
        backend/src/test/java/com/christmaslightmap/HostEntityTest.java
git commit -m "feat: support hostId in listing create/update/delete with host ownership check"
```

---

### Task 6: Handle resolution fallback in UserService

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/service/UserService.java`

The `GET /api/v1/users/handle/{handle}` endpoint must check the `hosts` table before the `users` table, so `/host/my-food-truck` resolves correctly after the host entity is created.

- [ ] **Step 1: Inject HostRepository into UserService**

In `UserService.java`, add to the constructor injection fields:

```java
private final HostRepository hostRepository;
```

Add import: `import com.christmaslightmap.repository.HostRepository;`
And: `import com.christmaslightmap.model.Host;`

- [ ] **Step 2: Replace getHostListingsByHandle**

Replace the existing `getHostListingsByHandle` method:

```java
public HostListingsResponse getHostListingsByHandle(String handle) {
    // Check hosts entity first
    return hostRepository.findByHandle(handle)
        .map(this::getHostListingsForHostEntity)
        .orElseGet(() -> {
            User user = userRepository.findByHandle(handle)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Host not found"));
            return getHostListings(user.getId());
        });
}

private HostListingsResponse getHostListingsForHostEntity(Host host) {
    List<Listing> listings = listingRepository.findUpcomingByHostId(host.getId(), LocalDateTime.now());

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

    HostUserResponse hostUser = HostUserResponse.builder()
        .id(host.getId())
        .name(host.getDisplayName())
        .displayName(host.getDisplayName())
        .avatarUrl(host.getAvatarUrl())
        .handle(host.getHandle())
        .build();

    return HostListingsResponse.builder()
        .user(hostUser)
        .listings(summaries)
        .build();
}
```

Add the necessary imports to `UserService.java`:
- `import com.christmaslightmap.model.Host;`
- `import com.christmaslightmap.repository.HostRepository;`

- [ ] **Step 3: Run tests**

Run: `cd backend && mvn test -q`
Expected: 35/36 pass (existing `getHostByHandle_returnsHostAndListings` in HostHandleTest still passes — it uses a user handle, not a host entity handle).

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/christmaslightmap/service/UserService.java
git commit -m "feat: resolve /host/{handle} via hosts table first, users table as fallback"
```

---

### Task 7: Frontend models + API service

**Files:**
- Modify: `frontend/src/app/models/listing.model.ts`
- Modify: `frontend/src/app/services/listing-api.service.ts`

- [ ] **Step 1: Add HostEntity interface to listing.model.ts**

In `frontend/src/app/models/listing.model.ts`, add after the `HostListingsResponse` interface:

```typescript
export interface HostEntity {
  id: number;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  listingCount: number;
  createdAt: string;
}
```

- [ ] **Step 2: Add hostId to CreateListingRequest and UpdateListingRequest**

In `CreateListingRequest`, add:
```typescript
hostId?: number | null;
```

In `UpdateListingRequest`, add:
```typescript
hostId?: number | null;
```

- [ ] **Step 3: Add host API methods to listing-api.service.ts**

In `frontend/src/app/services/listing-api.service.ts`, add the import for `HostEntity`:

```typescript
import {
  Listing, ListingSummary, Tag, Report, HostListingsResponse, HostSearchResult,
  HostEntity, PagedResponse, SearchParams, CreateListingRequest, UpdateListingRequest
} from '../models/listing.model';
```

Then add these methods at the end of the class, before the closing `}`:

```typescript
getMyHosts(): Observable<HostEntity[]> {
  return this.http.get<ApiResponse<HostEntity[]>>(
    `${this.base}/hosts/me`, { withCredentials: true }
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
```

- [ ] **Step 4: Build to verify no TypeScript errors**

Run: `cd frontend && npm run build -- --configuration development 2>&1 | tail -20`
Expected: `Build at:` success line, no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/models/listing.model.ts \
        frontend/src/app/services/listing-api.service.ts
git commit -m "feat: add HostEntity model and host CRUD methods to ListingApiService"
```

---

### Task 8: Profile page — Your Hosts section

**Files:**
- Modify: `frontend/src/app/pages/profile/profile.component.ts`

- [ ] **Step 1: Add HostEntity import and host signals to ProfileComponent**

In `frontend/src/app/pages/profile/profile.component.ts`:

Add `HostEntity` to the model import:
```typescript
import { ListingSummary, User, HostEntity, CATEGORY_COLORS, CATEGORY_LABELS, isExpired, formatDateRange, getInitials } from '../../models/listing.model';
```

Add these signals to the class body (after `handleLoading = signal(true);`):

```typescript
hosts = signal<HostEntity[]>([]);
hostsLoading = signal(true);
showCreateHost = signal(false);
newHostName = signal('');
newHostHandle = signal('');
creatingHost = signal(false);
createHostError = signal('');
editingHostId = signal<number | null>(null);
editHostName = signal('');
editHostHandle = signal('');
editHostError = signal('');
savingHostId = signal<number | null>(null);
transferringHostId = signal<number | null>(null);
transferHandle = signal('');
transferring = signal(false);
transferError = signal('');
confirmDeleteHostId = signal<number | null>(null);
deletingHost = signal(false);
```

- [ ] **Step 2: Load hosts in ngOnInit**

In `ngOnInit()`, after the existing `if (this.user)` block that loads the handle, add:

```typescript
if (this.user) {
  this.listingApi.getMyHosts().subscribe({
    next: h => { this.hosts.set(h); this.hostsLoading.set(false); },
    error: () => this.hostsLoading.set(false),
  });
}
```

- [ ] **Step 3: Add host management methods**

Add these methods to the class, after `saveHandle()`:

```typescript
createHost() {
  const name = this.newHostName().trim();
  const handle = this.newHostHandle().trim().toLowerCase();
  if (!name) { this.createHostError.set('Name is required.'); return; }
  if (!handle || handle.length < 3) { this.createHostError.set('Handle must be at least 3 characters.'); return; }
  if (handle.length > 30) { this.createHostError.set('Handle must be 30 characters or fewer.'); return; }
  if (!/^[a-z0-9-]+$/.test(handle)) { this.createHostError.set('Handle may only contain lowercase letters, numbers, and hyphens.'); return; }

  this.creatingHost.set(true);
  this.createHostError.set('');
  this.listingApi.createHost(name, handle).subscribe({
    next: h => {
      this.hosts.update(list => [h, ...list]);
      this.newHostName.set('');
      this.newHostHandle.set('');
      this.showCreateHost.set(false);
      this.creatingHost.set(false);
    },
    error: (err) => {
      this.creatingHost.set(false);
      this.createHostError.set(err.status === 409 ? 'That handle is already taken.' : 'Something went wrong.');
    },
  });
}

startEditHost(host: HostEntity) {
  this.editingHostId.set(host.id);
  this.editHostName.set(host.displayName);
  this.editHostHandle.set(host.handle);
  this.editHostError.set('');
}

cancelEditHost() {
  this.editingHostId.set(null);
  this.editHostError.set('');
}

saveHost(hostId: number) {
  const name = this.editHostName().trim();
  const handle = this.editHostHandle().trim().toLowerCase();
  if (!name) { this.editHostError.set('Name is required.'); return; }
  if (!handle || handle.length < 3) { this.editHostError.set('Handle must be at least 3 characters.'); return; }
  if (handle.length > 30) { this.editHostError.set('Handle must be 30 characters or fewer.'); return; }
  if (!/^[a-z0-9-]+$/.test(handle)) { this.editHostError.set('Handle may only contain lowercase letters, numbers, and hyphens.'); return; }

  this.savingHostId.set(hostId);
  this.editHostError.set('');
  this.listingApi.updateHost(hostId, name, handle).subscribe({
    next: updated => {
      this.hosts.update(list => list.map(h => h.id === hostId ? updated : h));
      this.editingHostId.set(null);
      this.savingHostId.set(null);
    },
    error: (err) => {
      this.savingHostId.set(null);
      this.editHostError.set(err.status === 409 ? 'That handle is already taken.' : 'Something went wrong.');
    },
  });
}

onHostAvatarChange(hostId: number, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  this.listingApi.uploadHostAvatar(hostId, file).subscribe({
    next: updated => this.hosts.update(list => list.map(h => h.id === hostId ? updated : h)),
    error: () => {},
  });
}

startTransferHost(hostId: number) {
  this.transferringHostId.set(hostId);
  this.transferHandle.set('');
  this.transferError.set('');
}

cancelTransferHost() {
  this.transferringHostId.set(null);
  this.transferError.set('');
}

doTransferHost(hostId: number) {
  const handle = this.transferHandle().trim().toLowerCase();
  if (!handle) { this.transferError.set('Enter the recipient\'s handle.'); return; }
  this.transferring.set(true);
  this.transferError.set('');
  this.listingApi.transferHost(hostId, handle).subscribe({
    next: () => {
      this.hosts.update(list => list.filter(h => h.id !== hostId));
      this.transferringHostId.set(null);
      this.transferring.set(false);
    },
    error: (err) => {
      this.transferring.set(false);
      this.transferError.set(
        err.status === 404 ? 'No user found with that handle.' :
        err.status === 400 ? 'You already own this host.' :
        'Something went wrong.'
      );
    },
  });
}

confirmDeleteHost(hostId: number) {
  this.confirmDeleteHostId.set(hostId);
}

cancelDeleteHost() {
  this.confirmDeleteHostId.set(null);
}

doDeleteHost(hostId: number) {
  this.deletingHost.set(true);
  this.listingApi.deleteHost(hostId).subscribe({
    next: () => {
      this.hosts.update(list => list.filter(h => h.id !== hostId));
      this.confirmDeleteHostId.set(null);
      this.deletingHost.set(false);
    },
    error: () => {
      this.deletingHost.set(false);
      this.confirmDeleteHostId.set(null);
    },
  });
}
```

- [ ] **Step 4: Add the Your Hosts section to the template**

In the template, after the handle section (`</div>` that closes the handle card at around line 96) and before the Tabs section, insert:

```html
<!-- Your Hosts -->
<div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;
            box-shadow:0 1px 6px rgba(0,0,0,0.06)">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <div style="font-weight:700;font-size:14px;color:#0f172a">Your Hosts</div>
    <button (click)="showCreateHost.set(!showCreateHost())"
            style="padding:6px 12px;background:var(--accent);color:white;border:none;
                   border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
      + Create Host
    </button>
  </div>

  <!-- Create form -->
  <div *ngIf="showCreateHost()"
       style="background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:14px">
    <input [ngModel]="newHostName()" (ngModelChange)="newHostName.set($event)"
           placeholder="Display name (e.g. Clayton's BBQ)"
           style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                  font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;
                  outline:none;margin-bottom:8px"/>
    <input [ngModel]="newHostHandle()" (ngModelChange)="newHostHandle.set($event)"
           placeholder="handle (e.g. claytons-bbq)"
           style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                  font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;
                  outline:none;margin-bottom:4px"/>
    <div style="font-size:11.5px;color:#64748b;margin-bottom:10px">
      eventmapster.com/host/{{newHostHandle() || 'yourhandle'}}
    </div>
    <div style="display:flex;gap:8px">
      <button (click)="createHost()"
              [disabled]="creatingHost()"
              [style.opacity]="creatingHost() ? '0.6' : '1'"
              style="padding:8px 16px;background:var(--accent);color:white;border:none;
                     border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
        {{creatingHost() ? 'Creating…' : 'Create'}}
      </button>
      <button (click)="showCreateHost.set(false)"
              style="padding:8px 14px;background:none;border:1.5px solid #e2e8f0;
                     border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b">
        Cancel
      </button>
    </div>
    <div *ngIf="createHostError()"
         style="font-size:12px;color:#ef4444;margin-top:6px">{{createHostError()}}</div>
  </div>

  <!-- Loading -->
  <div *ngIf="hostsLoading()"
       style="text-align:center;padding:20px 0;color:#94a3b8;font-size:13px">Loading…</div>

  <!-- Empty state -->
  <div *ngIf="!hostsLoading() && hosts().length === 0 && !showCreateHost()"
       style="text-align:center;padding:16px 0;color:#94a3b8;font-size:13px">
    No hosts yet. Create one to manage a brand's events.
  </div>

  <!-- Host cards -->
  <div *ngFor="let h of hosts()"
       style="border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px">

    <!-- View mode -->
    <div *ngIf="editingHostId() !== h.id && transferringHostId() !== h.id && confirmDeleteHostId() !== h.id">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <img *ngIf="h.avatarUrl" [src]="h.avatarUrl" [alt]="h.displayName"
             style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0"/>
        <app-avatar *ngIf="!h.avatarUrl" [initials]="getInitials(h.displayName)" [size]="44"/>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px;color:#0f172a">{{h.displayName}}</div>
          <div style="font-size:11.5px;color:#64748b;margin-top:1px">
            eventmapster.com/host/{{h.handle}} · {{h.listingCount}} listing{{h.listingCount !== 1 ? 's' : ''}}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button (click)="startEditHost(h)"
                style="padding:5px 12px;background:#e0f2fe;border:none;color:#0369a1;
                       border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
          Edit
        </button>
        <button (click)="startTransferHost(h.id)"
                style="padding:5px 12px;background:#f0fdf4;border:none;color:#166534;
                       border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
          Transfer
        </button>
        <button (click)="confirmDeleteHost(h.id)"
                [disabled]="h.listingCount > 0"
                [title]="h.listingCount > 0 ? 'Remove all listings before deleting' : ''"
                [style.opacity]="h.listingCount > 0 ? '0.4' : '1'"
                style="padding:5px 12px;background:#fee2e2;border:none;color:#dc2626;
                       border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
          Delete
        </button>
      </div>
    </div>

    <!-- Edit mode -->
    <div *ngIf="editingHostId() === h.id">
      <input [ngModel]="editHostName()" (ngModelChange)="editHostName.set($event)"
             placeholder="Display name"
             style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                    font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;
                    outline:none;margin-bottom:8px"/>
      <input [ngModel]="editHostHandle()" (ngModelChange)="editHostHandle.set($event)"
             placeholder="handle"
             style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                    font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;
                    outline:none;margin-bottom:4px"/>
      <div style="font-size:11.5px;color:#64748b;margin-bottom:8px">
        eventmapster.com/host/{{editHostHandle() || h.handle}}
      </div>
      <div style="margin-bottom:8px">
        <label style="font-size:12px;color:#64748b;font-weight:600;display:block;margin-bottom:4px">
          Avatar photo
        </label>
        <input type="file" accept="image/*" (change)="onHostAvatarChange(h.id, $event)"
               style="font-size:12px;color:#374151"/>
      </div>
      <div *ngIf="editHostError()"
           style="font-size:12px;color:#ef4444;margin-bottom:8px">{{editHostError()}}</div>
      <div style="display:flex;gap:6px">
        <button (click)="saveHost(h.id)"
                [disabled]="savingHostId() === h.id"
                [style.opacity]="savingHostId() === h.id ? '0.6' : '1'"
                style="padding:7px 14px;background:var(--accent);color:white;border:none;
                       border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
          {{savingHostId() === h.id ? 'Saving…' : 'Save'}}
        </button>
        <button (click)="cancelEditHost()"
                style="padding:7px 12px;background:none;border:1.5px solid #e2e8f0;
                       border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b">
          Cancel
        </button>
      </div>
    </div>

    <!-- Transfer mode -->
    <div *ngIf="transferringHostId() === h.id">
      <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px">
        Transfer "{{h.displayName}}" to another user
      </div>
      <input [ngModel]="transferHandle()" (ngModelChange)="transferHandle.set($event)"
             placeholder="Recipient's handle"
             style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;
                    font-size:13.5px;color:#0f172a;background:white;box-sizing:border-box;
                    outline:none;margin-bottom:8px"/>
      <div *ngIf="transferError()"
           style="font-size:12px;color:#ef4444;margin-bottom:8px">{{transferError()}}</div>
      <div style="display:flex;gap:6px">
        <button (click)="doTransferHost(h.id)"
                [disabled]="transferring()"
                [style.opacity]="transferring() ? '0.6' : '1'"
                style="padding:7px 14px;background:#dc2626;color:white;border:none;
                       border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
          {{transferring() ? 'Transferring…' : 'Transfer'}}
        </button>
        <button (click)="cancelTransferHost()"
                style="padding:7px 12px;background:none;border:1.5px solid #e2e8f0;
                       border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b">
          Cancel
        </button>
      </div>
    </div>

    <!-- Delete confirm -->
    <div *ngIf="confirmDeleteHostId() === h.id">
      <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:10px">
        Delete "{{h.displayName}}"? This cannot be undone.
      </div>
      <div style="display:flex;gap:6px">
        <button (click)="doDeleteHost(h.id)"
                [disabled]="deletingHost()"
                [style.opacity]="deletingHost() ? '0.6' : '1'"
                style="padding:7px 14px;background:#dc2626;color:white;border:none;
                       border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
          {{deletingHost() ? 'Deleting…' : 'Yes, delete'}}
        </button>
        <button (click)="cancelDeleteHost()"
                style="padding:7px 12px;background:none;border:1.5px solid #e2e8f0;
                       border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b">
          Cancel
        </button>
      </div>
    </div>

  </div>
</div>
```

- [ ] **Step 5: Build to verify no TypeScript errors**

Run: `cd frontend && npm run build -- --configuration development 2>&1 | tail -20`
Expected: Successful build with no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/pages/profile/profile.component.ts
git commit -m "feat: add Your Hosts section to profile page with create/edit/transfer/delete"
```

---

### Task 9: Submit form — Post as field

**Files:**
- Modify: `frontend/src/app/pages/submit/submit.component.ts`

- [ ] **Step 1: Add hosts signal and selectedHostId to SubmitComponent**

In `frontend/src/app/pages/submit/submit.component.ts`:

Add `HostEntity` to the model import:
```typescript
import { Category, DisplayType, Listing, ListingSummary, HostEntity, Tag, CreateListingRequest, UpdateListingRequest } from '../../models/listing.model';
```

Add these signals to the class body, near the top with the other signals:

```typescript
hosts = signal<HostEntity[]>([]);
selectedHostId = signal<number | null>(null);
```

- [ ] **Step 2: Load hosts in ngOnInit for authenticated users**

The `ngOnInit` currently handles the edit-listing case. Add host loading at the start of `ngOnInit`:

```typescript
ngOnInit() {
  if (this.user) {
    this.listingApi.getMyHosts().subscribe({
      next: h => {
        this.hosts.set(h);
        if (h.length > 0 && this.selectedHostId() === null) {
          this.selectedHostId.set(h[0].id);
        }
      },
      error: () => {},
    });
  }

  if (this.editListing) {
    // ... existing edit code unchanged ...
  }
}
```

- [ ] **Step 3: Include hostId in the submit payload**

Find the `submit()` or `createListing()` method that calls `this.listingApi.create(...)`. The payload object passed to create should include:

```typescript
hostId: this.selectedHostId(),
```

Add it alongside the existing fields in the request object. Find the `create(...)` call in the submit/save method and add `hostId: this.selectedHostId()` to the request body.

Similarly for the `update(...)` call (editing an existing listing), add `hostId: this.selectedHostId()`.

- [ ] **Step 4: Add "Post as" dropdown to the details step template**

In the template, find the details step section. After the category selector and before the title field, add:

```html
<!-- Post as (only shown when user has hosts) -->
<div *ngIf="user && hosts().length > 0">
  <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">
    Post as
  </label>
  <select [ngModel]="selectedHostId()"
          (ngModelChange)="selectedHostId.set($event === 'null' ? null : +$event)"
          style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                 font-size:13px;color:#0f172a;background:white;box-sizing:border-box">
    <option [ngValue]="null">Personal</option>
    <option *ngFor="let h of hosts()" [ngValue]="h.id">{{h.displayName}}</option>
  </select>
</div>
```

- [ ] **Step 5: Build to verify no TypeScript errors**

Run: `cd frontend && npm run build -- --configuration development 2>&1 | tail -20`
Expected: Successful build with no errors.

- [ ] **Step 6: Run full backend test suite one final time**

Run: `cd backend && mvn test -q`
Expected: 35/36 pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/pages/submit/submit.component.ts
git commit -m "feat: add Post as host selector to submit form"
```
