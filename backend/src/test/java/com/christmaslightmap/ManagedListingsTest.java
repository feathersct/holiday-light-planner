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

import static org.assertj.core.api.Assertions.assertThat;

class ManagedListingsTest extends BaseIntegrationTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private ListingRepository listingRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private HostRepository hostRepository;
    @Autowired private JwtService jwtService;

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

    private HttpHeaders authHeaders(User user) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(user));
        return headers;
    }

    @Test
    void getManagedListings_returnsAllListingsIncludingInactiveAndPast() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-ml1")
            .email("ml1@test.com").name("ML User 1")
            .role(UserRole.USER).handle("ml-user-1").build());

        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("ml-host-1").displayName("ML Host 1").build());

        // Active upcoming listing
        listingRepository.save(Listing.builder()
            .host(host).title("Active Future").location(point(-97.7, 30.2))
            .city("Austin").state("TX").category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .build());

        // Inactive listing
        listingRepository.save(Listing.builder()
            .host(host).title("Inactive Listing").location(point(-97.7, 30.2))
            .city("Austin").state("TX").category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .isActive(false)
            .build());

        // Past listing
        listingRepository.save(Listing.builder()
            .host(host).title("Past Listing").location(point(-97.7, 30.2))
            .city("Austin").state("TX").category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().minusDays(10))
            .endDatetime(LocalDateTime.now().minusDays(5))
            .isActive(false)
            .build());

        HttpEntity<Void> request = new HttpEntity<>(authHeaders(owner));
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/hosts/" + host.getId() + "/listings",
            HttpMethod.GET, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Active Future");
        assertThat(response.getBody()).contains("Inactive Listing");
        assertThat(response.getBody()).contains("Past Listing");
    }

    @Test
    void getManagedListings_returns401WithoutAuth() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/hosts/99999/listings", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getManagedListings_returns404ForNonExistentHost() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-ml2")
            .email("ml2@test.com").name("ML User 2")
            .role(UserRole.USER).handle("ml-user-2").build());

        HttpEntity<Void> request = new HttpEntity<>(authHeaders(owner));
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/hosts/99999/listings",
            HttpMethod.GET, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getManagedListings_returns403WhenNotOwner() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-ml3")
            .email("ml3@test.com").name("ML Owner")
            .role(UserRole.USER).handle("ml-owner-1").build());

        User other = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-ml4")
            .email("ml4@test.com").name("ML Other")
            .role(UserRole.USER).handle("ml-other-1").build());

        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("ml-host-2").displayName("ML Host 2").build());

        HttpEntity<Void> request = new HttpEntity<>(authHeaders(other));
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/hosts/" + host.getId() + "/listings",
            HttpMethod.GET, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
