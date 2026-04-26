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

class SetListingActiveTest extends BaseIntegrationTest {

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
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private Listing buildListing(Host host, boolean active) {
        return listingRepository.save(Listing.builder()
            .host(host).title("Test Listing").location(point(-97.7, 30.2))
            .city("Austin").state("TX").category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .isActive(active)
            .build());
    }

    @Test
    void setListingActive_ownerDeactivatesListing() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-sla1")
            .email("sla1@test.com").name("SLA User 1")
            .role(UserRole.USER).handle("sla-user-1").build());

        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("sla-host-1").displayName("SLA Host 1").build());

        Listing listing = buildListing(host, true);

        HttpEntity<Map<String, Boolean>> request = new HttpEntity<>(
            Map.of("active", false), authHeaders(owner));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/" + listing.getId() + "/active",
            HttpMethod.PATCH, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"isActive\":false");

        Listing updated = listingRepository.findById(listing.getId()).orElseThrow();
        assertThat(updated.isActive()).isFalse();
    }

    @Test
    void setListingActive_ownerReactivatesListing() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-sla2")
            .email("sla2@test.com").name("SLA User 2")
            .role(UserRole.USER).handle("sla-user-2").build());

        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("sla-host-2").displayName("SLA Host 2").build());

        Listing listing = buildListing(host, false);

        HttpEntity<Map<String, Boolean>> request = new HttpEntity<>(
            Map.of("active", true), authHeaders(owner));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/" + listing.getId() + "/active",
            HttpMethod.PATCH, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"isActive\":true");
    }

    @Test
    void setListingActive_returns401WithoutAuth() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/99999/active",
            HttpMethod.PATCH,
            new HttpEntity<>(Map.of("active", false)),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void setListingActive_returns403WhenNotOwner() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-sla3")
            .email("sla3@test.com").name("SLA Owner")
            .role(UserRole.USER).handle("sla-owner-1").build());

        User other = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-sla4")
            .email("sla4@test.com").name("SLA Other")
            .role(UserRole.USER).handle("sla-other-1").build());

        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("sla-host-3").displayName("SLA Host 3").build());

        Listing listing = buildListing(host, true);

        HttpEntity<Map<String, Boolean>> request = new HttpEntity<>(
            Map.of("active", false), authHeaders(other));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/" + listing.getId() + "/active",
            HttpMethod.PATCH, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void deleteListing_ownerHardDeletesListing() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-sla5")
            .email("sla5@test.com").name("SLA User 5")
            .role(UserRole.USER).handle("sla-user-5").build());

        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("sla-host-5").displayName("SLA Host 5").build());

        Listing listing = buildListing(host, true);
        Long listingId = listing.getId();

        HttpEntity<Void> request = new HttpEntity<>(authHeaders(owner));
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/" + listingId,
            HttpMethod.DELETE, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(listingRepository.findById(listingId)).isEmpty();
    }

    @Test
    void deleteListing_ownerCanDeleteInactiveListing() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-sla6")
            .email("sla6@test.com").name("SLA User 6")
            .role(UserRole.USER).handle("sla-user-6").build());

        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("sla-host-6").displayName("SLA Host 6").build());

        Listing listing = buildListing(host, false);
        Long listingId = listing.getId();

        HttpEntity<Void> request = new HttpEntity<>(authHeaders(owner));
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/" + listingId,
            HttpMethod.DELETE, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(listingRepository.findById(listingId)).isEmpty();
    }
}
