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

class HostListingsTest extends BaseIntegrationTest {

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
            .provider("facebook").providerId("fb-hl1")
            .email("hl1@test.com").name("Host Listing User")
            .role(UserRole.USER).handle("hl-user-1").build());

        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("hl-host-1").displayName("Host Listing").build());

        listingRepository.save(Listing.builder()
            .host(host).title("Active Listing")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/hosts/handle/hl-host-1", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Active Listing");
        assertThat(response.getBody()).contains("Host Listing");
    }

    @Test
    void getHostListings_returns401WithoutAuth() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/hosts/99999/listings", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getHostByHandle_returns404ForUnknownHandle() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/hosts/handle/hl-nonexistent-handle", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getHostByHandle_isPublicNoAuthRequired() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-hl2")
            .email("hl2@test.com").name("Public Host")
            .role(UserRole.USER).handle("hl-user-2").build());

        hostRepository.save(Host.builder()
            .owner(owner).handle("hl-public-host").displayName("Public Host").build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/hosts/handle/hl-public-host", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
