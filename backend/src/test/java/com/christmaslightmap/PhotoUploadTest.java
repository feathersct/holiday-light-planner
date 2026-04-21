package com.christmaslightmap;

import com.christmaslightmap.model.Display;
import com.christmaslightmap.model.User;
import com.christmaslightmap.model.UserRole;
import com.christmaslightmap.repository.DisplayPhotoRepository;
import com.christmaslightmap.repository.DisplayRepository;
import com.christmaslightmap.repository.UserRepository;
import com.christmaslightmap.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class PhotoUploadTest extends BaseIntegrationTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JwtService jwtService;
    @Autowired private UserRepository userRepository;
    @Autowired private DisplayRepository displayRepository;
    @Autowired private DisplayPhotoRepository displayPhotoRepository;

    @AfterEach
    void cleanUp() {
        displayPhotoRepository.deleteAll();
        displayRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void uploadPhoto_returns200AndIncrementsPhotoCount() {
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
            .thenReturn(PutObjectResponse.builder().build());

        User user = userRepository.save(User.builder()
            .provider("google").providerId("g1").email("photo@test.com")
            .name("Photo User").role(UserRole.USER).build());

        var loc = GF.createPoint(new Coordinate(-122.3321, 47.6062));
        loc.setSRID(4326);
        Display display = displayRepository.save(Display.builder()
            .user(user).title("Photo Display").location(loc).build());

        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(user));
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        ByteArrayResource fileResource = new ByteArrayResource("fake image bytes".getBytes()) {
            @Override public String getFilename() { return "test.jpg"; }
        };
        body.add("file", fileResource);

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/displays/" + display.getId() + "/photos",
            HttpMethod.POST,
            new HttpEntity<>(body, headers),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"url\"");
        assertThat(response.getBody()).contains("\"success\":true");

        Display updated = displayRepository.findById(display.getId()).orElseThrow();
        assertThat(updated.getPhotoCount()).isEqualTo(1);
    }
}
