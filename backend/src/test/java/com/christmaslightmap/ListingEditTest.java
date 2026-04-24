package com.christmaslightmap;

import com.christmaslightmap.dto.request.UpdateListingRequest;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ListingEditTest extends BaseIntegrationTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private ListingRepository listingRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JwtService jwtService;

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

    private HttpHeaders authHeaders(User user) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(user));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private UpdateListingRequest baseUpdateRequest() {
        UpdateListingRequest req = new UpdateListingRequest();
        req.setCategory(Category.CHRISTMAS_LIGHTS);
        req.setTitle("Updated Title");
        req.setDescription("Updated description");
        req.setAddress("123 Main St");
        req.setCity("Denver");
        req.setState("CO");
        req.setPostcode("80202");
        req.setLat(39.752);
        req.setLng(-104.979);
        req.setStartDatetime(LocalDateTime.now().minusDays(1));
        req.setEndDatetime(LocalDateTime.now().plusDays(30));
        req.setTagIds(List.of());
        return req;
    }

    @Test
    void update_owner_returnsUpdatedListing() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb1").email("owner@test.com")
            .name("Owner").role(UserRole.USER).handle("listing-edit-1").build());

        Listing listing = listingRepository.save(Listing.builder()
            .user(owner).title("Original Title").location(point(-104.979, 39.752))
            .category(Category.YARD_SALE)
            .startDatetime(LocalDateTime.now().minusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(30))
            .build());

        UpdateListingRequest req = baseUpdateRequest();
        HttpEntity<UpdateListingRequest> entity = new HttpEntity<>(req, authHeaders(owner));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/" + listing.getId(),
            HttpMethod.PATCH, entity, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Updated Title");
        assertThat(response.getBody()).contains("CHRISTMAS_LIGHTS");
    }

    @Test
    void update_nonOwner_returns403() {
        User owner = userRepository.save(User.builder()
            .provider("facebook").providerId("fb2").email("owner2@test.com")
            .name("Owner2").role(UserRole.USER).handle("listing-edit-2").build());
        User other = userRepository.save(User.builder()
            .provider("facebook").providerId("fb3").email("other@test.com")
            .name("Other").role(UserRole.USER).handle("listing-edit-3").build());

        Listing listing = listingRepository.save(Listing.builder()
            .user(owner).title("Owner Listing").location(point(-104.979, 39.752))
            .category(Category.CHRISTMAS_LIGHTS)
            .startDatetime(LocalDateTime.now().minusDays(1))
            .endDatetime(LocalDateTime.now().plusDays(30))
            .build());

        HttpEntity<UpdateListingRequest> entity = new HttpEntity<>(baseUpdateRequest(), authHeaders(other));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/" + listing.getId(),
            HttpMethod.PATCH, entity, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void update_notFound_returns404() {
        User user = userRepository.save(User.builder()
            .provider("facebook").providerId("fb4").email("u4@test.com")
            .name("User4").role(UserRole.USER).handle("listing-edit-4").build());

        HttpEntity<UpdateListingRequest> entity = new HttpEntity<>(baseUpdateRequest(), authHeaders(user));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/99999",
            HttpMethod.PATCH, entity, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void update_unauthenticated_returns401() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/listings/99999",
            HttpMethod.PATCH,
            new HttpEntity<>(baseUpdateRequest()),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
