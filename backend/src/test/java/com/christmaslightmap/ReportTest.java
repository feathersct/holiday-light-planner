package com.christmaslightmap;

import com.christmaslightmap.dto.request.ReportRequest;
import com.christmaslightmap.model.*;
import com.christmaslightmap.repository.*;
import com.christmaslightmap.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;

import static org.assertj.core.api.Assertions.assertThat;

class ReportTest extends BaseIntegrationTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JwtService jwtService;
    @Autowired private UserRepository userRepository;
    @Autowired private DisplayRepository displayRepository;
    @Autowired private ReportRepository reportRepository;

    @AfterEach
    void cleanUp() {
        reportRepository.deleteAll();
        displayRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void createReport_savesOpenReportInDB() {
        User user = userRepository.save(User.builder()
            .provider("google").providerId("g1").email("reporter@test.com")
            .name("Reporter").role(UserRole.USER).build());

        var loc = GF.createPoint(new Coordinate(-122.3321, 47.6062));
        loc.setSRID(4326);
        Display display = displayRepository.save(Display.builder()
            .user(user).title("Reported Display").location(loc).build());

        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jwt=" + jwtService.generateToken(user));
        headers.setContentType(MediaType.APPLICATION_JSON);

        ReportRequest body = new ReportRequest();
        body.setReason(ReportReason.SPAM);
        body.setNotes("This looks fake");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/displays/" + display.getId() + "/report",
            HttpMethod.POST,
            new HttpEntity<>(body, headers),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        var reports = reportRepository.findAll();
        assertThat(reports).hasSize(1);
        assertThat(reports.get(0).getStatus()).isEqualTo(ReportStatus.OPEN);
        assertThat(reports.get(0).getReason()).isEqualTo(ReportReason.SPAM);
    }
}
