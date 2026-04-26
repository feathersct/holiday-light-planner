package com.christmaslightmap;

import com.christmaslightmap.model.*;
import com.christmaslightmap.repository.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class HostHandleTest extends BaseIntegrationTest {

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
    void getHostByHandle_returnsHostAndListings() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-handle1")
            .email("handle@test.com").name("Handle Host")
            .handle("handle-host-user")
            .role(UserRole.USER).build());

        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("handle-host").displayName("Handle Host").build());

        listingRepository.save(Listing.builder()
            .host(host).title("Handle Event")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/hosts/handle/handle-host", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Handle Host");
        assertThat(response.getBody()).contains("\"handle-host\"");
        assertThat(response.getBody()).contains("Handle Event");
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
            .provider("facebook").providerId("fb-handle6")
            .email("public@test.com").name("Public Host")
            .handle("public-host-user")
            .role(UserRole.USER).build());

        hostRepository.save(Host.builder()
            .owner(owner).handle("public-host").displayName("Public Host").build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/hosts/handle/public-host", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

}
