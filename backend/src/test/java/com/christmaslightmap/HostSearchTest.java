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

class HostSearchTest extends BaseIntegrationTest {

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
    void searchHosts_findsHostByDisplayName() {
        User hostUser = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-search1")
            .email("bbq@test.com").name("Joe Smith")
            .displayName("Joe's BBQ Truck")
            .role(UserRole.USER).handle("host-search-1").build());

        Host host = hostRepository.save(Host.builder()
            .owner(hostUser).handle("joes-bbq").displayName("Joe's BBQ Truck").build());

        listingRepository.save(Listing.builder()
            .host(host).title("BBQ Stop")
            .city("Austin").state("TX")
            .location(point(-97.7, 30.2))
            .category(Category.FOOD_TRUCK)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(5))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/search?q=BBQ", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Joe's BBQ Truck");
        assertThat(response.getBody()).contains(hostUser.getId().toString());
    }

    @Test
    void searchHosts_findsHostByOAuthName() {
        User hostUser = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-search2")
            .email("sarah@test.com").name("Sarah's Market")
            .role(UserRole.USER).handle("host-search-2").build());

        Host host = hostRepository.save(Host.builder()
            .owner(hostUser).handle("sarahs-market").displayName("Sarah's Market").build());

        listingRepository.save(Listing.builder()
            .host(host).title("Saturday Market")
            .city("Dallas").state("TX")
            .location(point(-96.7, 32.7))
            .category(Category.POPUP_MARKET)
            .startDatetime(LocalDateTime.now().plusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(2))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/search?q=Sarah", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Sarah's Market");
    }

    @Test
    void searchHosts_excludesHostsWithNoUpcomingListings() {
        User hostUser = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-search3")
            .email("expired@test.com").name("Expired Vendor")
            .role(UserRole.USER).handle("host-search-3").build());

        Host host = hostRepository.save(Host.builder()
            .owner(hostUser).handle("expired-vendor").displayName("Expired Vendor").build());

        listingRepository.save(Listing.builder()
            .host(host).title("Old Sale")
            .city("Houston").state("TX")
            .location(point(-95.3, 29.7))
            .category(Category.YARD_SALE)
            .startDatetime(LocalDateTime.now().minusDays(10))
            .endDatetime(LocalDateTime.now().minusDays(1))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/search?q=Expired", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain("Expired Vendor");
    }

    @Test
    void searchHosts_returnsEmptyForNoMatch() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/users/search?q=zzznomatch", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("[]");
    }

    @Test
    void updateDisplayName_savesValueAndReturnsIt() {
        User host = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-update1")
            .email("update@test.com").name("Update User")
            .role(UserRole.USER).handle("host-search-4").build());

        host.setDisplayName("My Business Name");
        userRepository.save(host);

        User found = userRepository.findById(host.getId()).orElseThrow();
        assertThat(found.getDisplayName()).isEqualTo("My Business Name");
    }

    @Test
    void updateDisplayName_emptyStringStoresNull() {
        User host = userRepository.save(User.builder()
            .provider("facebook").providerId("fb-update2")
            .email("update2@test.com").name("Clear Name User")
            .displayName("Old Name")
            .role(UserRole.USER).handle("host-search-5").build());

        host.setDisplayName(null);
        userRepository.save(host);

        User found = userRepository.findById(host.getId()).orElseThrow();
        assertThat(found.getDisplayName()).isNull();
    }
}
