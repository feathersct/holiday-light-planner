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
import com.christmaslightmap.repository.ReportRepository;
import com.christmaslightmap.repository.UpvoteRepository;

import static org.assertj.core.api.Assertions.assertThat;

class DisplayManagementTest extends BaseIntegrationTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JwtService jwtService;
    @Autowired private UserRepository userRepository;
    @Autowired private DisplayRepository displayRepository;
    @Autowired private ReportRepository reportRepository;
    @Autowired private UpvoteRepository upvoteRepository;

    @AfterEach
    void cleanUp() {
        reportRepository.deleteAll();
        upvoteRepository.deleteAll();
        displayRepository.deleteAll();
        userRepository.deleteAll();
    }

    private Point point(double lng, double lat) {
        Point p = GF.createPoint(new Coordinate(lng, lat));
        p.setSRID(4326);
        return p;
    }

    @Test
    void deleteDisplay_owner_softDeletesDisplay() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb1").email("owner@test.com")
            .name("Owner").role(UserRole.USER).build());
        Display display = displayRepository.save(Display.builder()
            .user(owner).title("My Display").location(point(-122.33, 47.61)).build());

        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(owner));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/displays/" + display.getId(),
            HttpMethod.DELETE, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Display updated = displayRepository.findById(display.getId()).orElseThrow();
        assertThat(updated.isActive()).isFalse();
    }

    @Test
    void deleteDisplay_nonOwner_returns403() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb1").email("owner@test.com")
            .name("Owner").role(UserRole.USER).build());
        User other = userRepository.save(User.builder()
            .provider("facebook").providerId("fb2").email("other@test.com")
            .name("Other").role(UserRole.USER).build());
        Display display = displayRepository.save(Display.builder()
            .user(owner).title("My Display").location(point(-122.33, 47.61)).build());

        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(other));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/displays/" + display.getId(),
            HttpMethod.DELETE, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void deleteDisplay_unauthenticated_returns401() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb1").email("owner@test.com")
            .name("Owner").role(UserRole.USER).build());
        Display display = displayRepository.save(Display.builder()
            .user(owner).title("My Display").location(point(-122.33, 47.61)).build());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/displays/" + display.getId(),
            HttpMethod.DELETE, new HttpEntity<>(new HttpHeaders()), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void adminGetDisplays_admin_returnsAllDisplays() {
        User admin = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-admin").email("admin@test.com")
            .name("Admin").role(UserRole.ADMIN).build());
        User user = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-user").email("user@test.com")
            .name("User").role(UserRole.USER).build());
        displayRepository.save(Display.builder()
            .user(user).title("Active Display").location(point(-122.33, 47.61)).build());
        Display inactive = displayRepository.save(Display.builder()
            .user(user).title("Inactive Display").location(point(-122.33, 47.61)).build());
        inactive.setActive(false);
        displayRepository.save(inactive);

        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(admin));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/admin/displays", HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Active Display");
        assertThat(response.getBody()).contains("Inactive Display");
    }

    @Test
    void adminSetDisplayActive_admin_togglesActiveStatus() {
        User admin = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-admin").email("admin@test.com")
            .name("Admin").role(UserRole.ADMIN).build());
        User user = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-user").email("user@test.com")
            .name("User").role(UserRole.USER).build());
        Display display = displayRepository.save(Display.builder()
            .user(user).title("Active Display").location(point(-122.33, 47.61)).build());

        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(admin));
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/admin/displays/" + display.getId() + "/status",
            HttpMethod.PATCH,
            new HttpEntity<>("{\"active\":false}", headers),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(displayRepository.findById(display.getId()).orElseThrow().isActive()).isFalse();
    }

    @Test
    void adminDeleteDisplay_admin_hardDeletesDisplay() {
        User admin = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-admin").email("admin@test.com")
            .name("Admin").role(UserRole.ADMIN).build());
        User user = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-user").email("user@test.com")
            .name("User").role(UserRole.USER).build());
        Display display = displayRepository.save(Display.builder()
            .user(user).title("To Delete").location(point(-122.33, 47.61)).build());

        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(admin));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/admin/displays/" + display.getId(),
            HttpMethod.DELETE, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(displayRepository.findById(display.getId())).isEmpty();
    }

    @Test
    void adminGetDisplays_nonAdmin_returns403() {
        User user = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-user").email("user@test.com")
            .name("User").role(UserRole.USER).build());

        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(user));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/admin/displays", HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
