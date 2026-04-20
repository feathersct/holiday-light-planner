package com.christmaslightmap.security;

import com.christmaslightmap.model.User;
import com.christmaslightmap.model.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private JwtService jwtService;
    private User testUser;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secret",
            "test-secret-key-that-is-at-least-32-characters-long!!");
        ReflectionTestUtils.setField(jwtService, "expirationDays", 7);

        testUser = User.builder()
            .id(42L)
            .email("test@example.com")
            .role(UserRole.USER)
            .build();
    }

    @Test
    void generateToken_producesNonBlankToken() {
        String token = jwtService.generateToken(testUser);
        assertThat(token).isNotBlank();
    }

    @Test
    void isTokenValid_returnsTrueForFreshToken() {
        String token = jwtService.generateToken(testUser);
        assertThat(jwtService.isTokenValid(token)).isTrue();
    }

    @Test
    void getUserId_extractsCorrectId() {
        String token = jwtService.generateToken(testUser);
        assertThat(jwtService.getUserId(token)).isEqualTo(42L);
    }

    @Test
    void getEmail_extractsCorrectEmail() {
        String token = jwtService.generateToken(testUser);
        assertThat(jwtService.getEmail(token)).isEqualTo("test@example.com");
    }

    @Test
    void getRole_extractsCorrectRole() {
        String token = jwtService.generateToken(testUser);
        assertThat(jwtService.getRole(token)).isEqualTo("USER");
    }

    @Test
    void isTokenValid_returnsFalseForTamperedToken() {
        String token = jwtService.generateToken(testUser) + "tampered";
        assertThat(jwtService.isTokenValid(token)).isFalse();
    }
}
