package com.christmaslightmap;

import com.christmaslightmap.model.Display;
import com.christmaslightmap.model.User;
import com.christmaslightmap.model.UserRole;
import com.christmaslightmap.repository.DisplayRepository;
import com.christmaslightmap.repository.UpvoteRepository;
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
    @Autowired private UpvoteRepository upvoteRepository;

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
        upvoteRepository.deleteAll();
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
