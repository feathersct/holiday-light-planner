package com.christmaslightmap;

import com.christmaslightmap.model.User;
import com.christmaslightmap.model.UserRole;
import com.christmaslightmap.repository.UserRepository;
import com.christmaslightmap.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;

import static org.assertj.core.api.Assertions.assertThat;

class AuthControllerTest extends BaseIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @AfterEach
    void cleanUp() {
        userRepository.deleteAll();
    }

    @Test
    void getMe_withoutCookie_returns401() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/v1/auth/me", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getMe_withValidCookie_returns200WithUser() {
        User user = userRepository.save(User.builder()
            .provider("google")
            .providerId("google-test-123")
            .email("test@example.com")
            .name("Test User")
            .role(UserRole.USER)
            .handle("auth-user-1")
            .build());

        String token = jwtService.generateToken(user);

        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + token);
        HttpEntity<Void> request = new HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/auth/me", HttpMethod.GET, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("test@example.com");
        assertThat(response.getBody()).contains("\"success\":true");
    }

    @Test
    void logout_clearsCookie() {
        User user = userRepository.save(User.builder()
            .provider("google")
            .providerId("google-test-456")
            .email("logout@example.com")
            .name("Logout User")
            .role(UserRole.USER)
            .handle("auth-user-2")
            .build());

        String token = jwtService.generateToken(user);
        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + token);
        HttpEntity<Void> request = new HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/auth/logout", HttpMethod.POST, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE))
            .anyMatch(c -> c.contains("jwt=") && c.contains("Max-Age=0"));
    }
}
