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

class HostProfileTest extends BaseIntegrationTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private ListingRepository listingRepository;
    @Autowired private UserRepository userRepository;

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

    @Test
    void getHostListings_returnsOnlyUpcomingActiveListings() {
        User host = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-host1")
            .email("host@test.com").name("Test Host")
            .role(UserRole.USER).handle("host-profile-1").build());

        listingRepository.save(Listing.builder()
            .user(host).title("Upcoming Event")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .build());

        listingRepository.save(Listing.builder()
            .user(host).title("Expired Event")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().minusDays(10))
            .endDatetime(LocalDateTime.now().minusDays(1))
            .build());

        listingRepository.save(Listing.builder()
            .user(host).title("Inactive Event")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .isActive(false)
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/" + host.getId() + "/listings", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Upcoming Event");
        assertThat(response.getBody()).doesNotContain("Expired Event");
        assertThat(response.getBody()).doesNotContain("Inactive Event");
        assertThat(response.getBody()).contains("Test Host");
    }

    @Test
    void getHostListings_returns404ForUnknownUser() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/99999/listings", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getListingById_includesSubmitterNameAndAvatarUrl() {
        User host = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-host2")
            .email("host2@test.com").name("Named Host")
            .role(UserRole.USER).handle("host-profile-2").build());

        Listing listing = listingRepository.save(Listing.builder()
            .user(host).title("Named Event")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().minusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(30))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/listings/" + listing.getId(), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("submittedByName");
        assertThat(response.getBody()).contains("Named Host");
        assertThat(response.getBody()).contains("submittedByAvatarUrl");
    }

    @Test
    void getListingById_usesHostNameOverDisplayName() {
        User host = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-hostname1")
            .email("hostname@test.com").name("OAuth Name")
            .displayName("Profile Display Name")
            .role(UserRole.USER).handle("host-profile-3").build());

        Listing listing = listingRepository.save(Listing.builder()
            .user(host).title("Override Event")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.FOOD_TRUCK)
            .startDatetime(LocalDateTime.now().minusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(30))
            .hostName("Per-Listing Name")
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/listings/" + listing.getId(), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Per-Listing Name");
        assertThat(response.getBody()).doesNotContain("Profile Display Name");
    }

    @Test
    void getListingById_fallsBackToDisplayNameWhenNoHostName() {
        User host = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-hostname2")
            .email("hostname2@test.com").name("OAuth Name")
            .displayName("Profile Display Name")
            .role(UserRole.USER).handle("host-profile-4").build());

        Listing listing = listingRepository.save(Listing.builder()
            .user(host).title("Fallback Event")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.FOOD_TRUCK)
            .startDatetime(LocalDateTime.now().minusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(30))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/listings/" + listing.getId(), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Profile Display Name");
        assertThat(response.getBody()).doesNotContain("OAuth Name");
    }
}
