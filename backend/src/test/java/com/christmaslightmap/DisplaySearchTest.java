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
