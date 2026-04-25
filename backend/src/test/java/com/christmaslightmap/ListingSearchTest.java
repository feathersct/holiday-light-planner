package com.christmaslightmap;

import com.christmaslightmap.model.Category;
import com.christmaslightmap.model.Host;
import com.christmaslightmap.model.Listing;
import com.christmaslightmap.model.User;
import com.christmaslightmap.model.UserRole;
import com.christmaslightmap.repository.HostRepository;
import com.christmaslightmap.repository.ListingRepository;
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

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class ListingSearchTest extends BaseIntegrationTest {

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

    private Listing.ListingBuilder baseListing(Host host, String title, Point location) {
        return Listing.builder()
            .host(host).title(title).location(location)
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().minusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(30));
    }

    @Test
    void search_withinRadius_returnsOnlyNearbyListings() {
        User user = userRepository.save(User.builder()
            .provider("google").providerId("g1").email("u@test.com")
            .name("User").role(UserRole.USER).handle("listing-search-1").build());

        Host host = hostRepository.save(Host.builder()
            .owner(user).handle("listing-search-host-1").displayName("Search Host 1").build());

        listingRepository.save(baseListing(host, "Seattle Listing 1", point(-122.3321, 47.6062)).build());
        listingRepository.save(baseListing(host, "Seattle Listing 2", point(-122.30, 47.61)).build());
        // Portland ~174 miles away — outside 10-mile radius
        listingRepository.save(baseListing(host, "Portland Listing", point(-122.6750, 45.5051)).build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/listings/search?lat=47.6062&lng=-122.3321&radiusMiles=10", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Seattle Listing 1");
        assertThat(response.getBody()).contains("Seattle Listing 2");
        assertThat(response.getBody()).doesNotContain("Portland Listing");
    }

    @Test
    void search_emptyArea_returnsEmptyPage() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/listings/search?lat=0.0&lng=0.0&radiusMiles=1", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"totalElements\":0");
    }

    @Test
    void search_expiredListing_notReturnedByDefault() {
        User user = userRepository.save(User.builder()
            .provider("google").providerId("g2").email("u2@test.com")
            .name("User2").role(UserRole.USER).handle("listing-search-2").build());

        Host host = hostRepository.save(Host.builder()
            .owner(user).handle("listing-search-host-2").displayName("Search Host 2").build());

        listingRepository.save(Listing.builder()
            .host(host).title("Expired Yard Sale").location(point(-122.3321, 47.6062))
            .category(Category.YARD_SALE)
            .startDatetime(LocalDateTime.now().minusDays(10))
            .endDatetime(LocalDateTime.now().minusDays(1))
            .build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/listings/search?lat=47.6062&lng=-122.3321&radiusMiles=10", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain("Expired Yard Sale");
    }

    @Test
    void search_categoryFilter_returnsOnlyMatchingCategory() {
        User user = userRepository.save(User.builder()
            .provider("google").providerId("g3").email("u3@test.com")
            .name("User3").role(UserRole.USER).handle("listing-search-3").build());

        Host host = hostRepository.save(Host.builder()
            .owner(user).handle("listing-search-host-3").displayName("Search Host 3").build());

        listingRepository.save(baseListing(host, "Xmas Lights", point(-122.3321, 47.6062)).build());
        listingRepository.save(baseListing(host, "Yard Sale", point(-122.3321, 47.6062))
            .category(Category.YARD_SALE).build());

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/listings/search?lat=47.6062&lng=-122.3321&radiusMiles=10&category=YARD_SALE", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Yard Sale");
        assertThat(response.getBody()).doesNotContain("Xmas Lights");
    }
}
