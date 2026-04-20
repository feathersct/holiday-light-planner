package com.christmaslightmap;

import com.christmaslightmap.model.User;
import com.christmaslightmap.model.UserRole;
import com.christmaslightmap.repository.UserRepository;
import com.christmaslightmap.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class AuthControllerTest {

    @Container
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>(
            DockerImageName.parse("postgis/postgis:15-3.3")
                .asCompatibleSubstituteFor("postgres"))
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

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
            .build());

        String token = jwtService.generateToken(user);
        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + token);
        HttpEntity<Void> request = new HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/auth/logout", HttpMethod.POST, request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE))
            .contains("jwt=")
            .contains("Max-Age=0");
    }
}
