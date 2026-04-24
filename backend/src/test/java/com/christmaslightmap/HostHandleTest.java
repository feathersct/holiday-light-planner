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

    @Test
    void updateHandle_returns401WhenUnauthenticated() {
        HttpEntity<Map<String, String>> request = new HttpEntity<>(
            Map.of("handle", "some-handle"),
            new HttpHeaders() {{ setContentType(MediaType.APPLICATION_JSON); }}
        );

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/users/me/handle", HttpMethod.PATCH, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
