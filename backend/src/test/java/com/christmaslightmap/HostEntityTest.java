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

class HostEntityTest extends BaseIntegrationTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private UserRepository userRepository;
    @Autowired private HostRepository hostRepository;
    @Autowired private ListingRepository listingRepository;
    @Autowired private JwtService jwtService;

    @AfterEach
    void cleanUp() {
        listingRepository.deleteAll();
        hostRepository.deleteAll();
        userRepository.deleteAll();
    }

    private HttpHeaders authHeaders(User user) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(user));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private User savedUser(String suffix) {
        return userRepository.save(User.builder()
            .provider("facebook").providerId("fb-host-" + suffix)
            .email(suffix + "@test.com").name("User " + suffix)
            .handle("user-" + suffix)
            .role(UserRole.USER).build());
    }

    private Point point(double lng, double lat) {
        Point p = GF.createPoint(new Coordinate(lng, lat));
        p.setSRID(4326);
        return p;
    }

    @Test
    void createHost_succeeds() {
        User user = savedUser("create1");
        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("displayName", "Clayton's BBQ", "handle", "claytons-bbq"),
            authHeaders(user));

        ResponseEntity<String> resp = restTemplate.postForEntity("/api/v1/hosts", req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).contains("claytons-bbq");
        assertThat(resp.getBody()).contains("Clayton's BBQ");
    }

    @Test
    void createHost_returns409WhenHandleTakenByUser() {
        User user = savedUser("create2");
        // user-create2 handle is already used by the user itself
        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("displayName", "Conflict Host", "handle", "user-create2"),
            authHeaders(user));

        ResponseEntity<String> resp = restTemplate.postForEntity("/api/v1/hosts", req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void createHost_returns409WhenHandleTakenByHost() {
        User user = savedUser("create3");
        hostRepository.save(Host.builder()
            .owner(user).handle("taken-host").displayName("Taken").build());

        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("displayName", "Another Host", "handle", "taken-host"),
            authHeaders(user));

        ResponseEntity<String> resp = restTemplate.postForEntity("/api/v1/hosts", req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void getMyHosts_returnsOwnedHosts() {
        User user = savedUser("list1");
        hostRepository.save(Host.builder()
            .owner(user).handle("my-truck").displayName("My Truck").build());

        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/me", HttpMethod.GET,
            new HttpEntity<>(authHeaders(user)), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains("my-truck");
    }

    @Test
    void updateHost_succeeds() {
        User user = savedUser("update1");
        Host host = hostRepository.save(Host.builder()
            .owner(user).handle("old-truck").displayName("Old Name").build());

        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("displayName", "New Name", "handle", "new-truck"),
            authHeaders(user));

        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/" + host.getId(), HttpMethod.PATCH, req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains("New Name");
        assertThat(resp.getBody()).contains("new-truck");
    }

    @Test
    void deleteHost_succeedsWhenNoActiveListings() {
        User user = savedUser("delete1");
        Host host = hostRepository.save(Host.builder()
            .owner(user).handle("del-truck").displayName("Del Truck").build());

        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/" + host.getId(), HttpMethod.DELETE,
            new HttpEntity<>(authHeaders(user)), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(hostRepository.findById(host.getId())).isEmpty();
    }

    @Test
    void transferHost_succeeds() {
        User owner = savedUser("transfer1");
        User recipient = savedUser("transfer2");
        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("transfer-truck").displayName("Transfer Truck").build());

        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("targetHandle", "user-transfer2"),
            authHeaders(owner));

        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/" + host.getId() + "/transfer",
            HttpMethod.POST, req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        Host updated = hostRepository.findById(host.getId()).orElseThrow();
        assertThat(updated.getOwner().getId()).isEqualTo(recipient.getId());
    }

    @Test
    void transferHost_returns400WhenTransferringToSelf() {
        User owner = savedUser("transfer3");
        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("self-truck").displayName("Self Truck").build());

        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("targetHandle", "user-transfer3"),
            authHeaders(owner));

        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/" + host.getId() + "/transfer",
            HttpMethod.POST, req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void transferHost_returns404WhenTargetHandleNotFound() {
        User owner = savedUser("transfer4");
        Host host = hostRepository.save(Host.builder()
            .owner(owner).handle("notfound-truck").displayName("Not Found Truck").build());

        HttpEntity<Map<String, String>> req = new HttpEntity<>(
            Map.of("targetHandle", "nonexistent-handle"),
            authHeaders(owner));

        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/" + host.getId() + "/transfer",
            HttpMethod.POST, req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void hostEndpoints_return401WhenUnauthenticated() {
        ResponseEntity<String> resp = restTemplate.exchange(
            "/api/v1/hosts/me", HttpMethod.GET,
            new HttpEntity<>(new HttpHeaders()), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
