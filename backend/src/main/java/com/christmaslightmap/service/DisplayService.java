package com.christmaslightmap.service;

import com.christmaslightmap.dto.response.DisplayResponse;
import com.christmaslightmap.dto.response.DisplaySummaryResponse;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.dto.response.TagResponse;
import com.christmaslightmap.dto.request.CreateDisplayRequest;
import com.christmaslightmap.model.Display;
import com.christmaslightmap.model.DisplayPhoto;
import com.christmaslightmap.model.DisplayType;
import com.christmaslightmap.repository.DisplayPhotoRepository;
import com.christmaslightmap.repository.DisplayRepository;
import com.christmaslightmap.repository.TagRepository;
import com.christmaslightmap.repository.UpvoteRepository;
import com.christmaslightmap.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DisplayService {

    private static final GeometryFactory GEOMETRY_FACTORY =
        new GeometryFactory(new PrecisionModel(), 4326);

    private final DisplayRepository displayRepository;
    private final UserRepository userRepository;
    private final TagRepository tagRepository;
    private final DisplayPhotoRepository displayPhotoRepository;
    private final UpvoteRepository upvoteRepository;

    public PagedResponse<DisplaySummaryResponse> searchDisplays(
            double lat, double lng, double radiusMiles,
            List<Long> tagIds, String displayType, int page, int size) {

        double radiusMetres = radiusMiles * 1609.34;
        int offset = page * size;
        String displayTypeStr = (displayType != null && !displayType.isBlank()) ? displayType : null;

        List<Object[]> rows;
        long total;
        if (tagIds == null || tagIds.isEmpty()) {
            rows = displayRepository.searchDisplays(lat, lng, radiusMetres, displayTypeStr, size, offset);
            total = displayRepository.countSearchDisplays(lat, lng, radiusMetres, displayTypeStr);
        } else {
            rows = displayRepository.searchDisplaysWithTags(lat, lng, radiusMetres, displayTypeStr, tagIds, size, offset);
            total = displayRepository.countSearchDisplaysWithTags(lat, lng, radiusMetres, displayTypeStr, tagIds);
        }

        List<DisplaySummaryResponse> summaries = rows.stream()
            .map(this::mapRowToSummary)
            .collect(Collectors.toList());

        if (!summaries.isEmpty()) {
            List<Long> ids = summaries.stream().map(DisplaySummaryResponse::getId).collect(Collectors.toList());
            List<Display> withTags = displayRepository.findByIdInWithTags(ids);
            Map<Long, List<TagResponse>> tagMap = withTags.stream().collect(Collectors.toMap(
                Display::getId,
                d -> d.getTags().stream().map(TagResponse::from).collect(Collectors.toList())
            ));
            summaries.forEach(s -> s.setTags(tagMap.getOrDefault(s.getId(), List.of())));
        }

        return PagedResponse.<DisplaySummaryResponse>builder()
            .content(summaries)
            .page(page)
            .size(size)
            .totalElements(total)
            .totalPages(total == 0 ? 0 : (int) Math.ceil((double) total / size))
            .last((long) (offset + size) >= total)
            .build();
    }

    public DisplayResponse getById(Long id) {
        Display display = displayRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Display not found"));
        return DisplayResponse.from(display, displayPhotoRepository.findByDisplay_Id(id));
    }

    @Transactional
    public DisplayResponse createDisplay(Long userId, CreateDisplayRequest request) {
        var user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(request.getLng(), request.getLat()));
        location.setSRID(4326);

        var tags = new HashSet<>(tagRepository.findAllById(
            request.getTagIds() != null ? request.getTagIds() : List.of()));

        Display display = displayRepository.save(Display.builder()
            .user(user)
            .title(request.getTitle())
            .description(request.getDescription())
            .address(request.getAddress())
            .city(request.getCity())
            .state(request.getState())
            .postcode(request.getPostcode())
            .location(location)
            .bestTime(request.getBestTime())
            .displayType(request.getDisplayType() != null ? request.getDisplayType() : DisplayType.DRIVE_BY)
            .tags(tags)
            .build());

        return DisplayResponse.from(display, List.of());
    }

    @Transactional
    public void deleteDisplay(Long userId, Long displayId) {
        Display display = displayRepository.findById(displayId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Display not found"));
        if (!display.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your display");
        }
        display.setActive(false);
        displayRepository.save(display);
    }

    public List<DisplaySummaryResponse> getMyDisplays(Long userId) {
        List<Display> displays = displayRepository.findByUserIdAndIsActiveTrue(userId);
        return toSummaries(displays);
    }

    public List<DisplaySummaryResponse> getUpvotedDisplays(Long userId) {
        List<Display> displays = upvoteRepository.findByUserIdWithActiveDisplays(userId).stream()
            .map(u -> u.getDisplay())
            .collect(Collectors.toList());
        return toSummaries(displays);
    }

    private List<DisplaySummaryResponse> toSummaries(List<Display> displays) {
        if (displays.isEmpty()) return List.of();
        List<Long> ids = displays.stream().map(Display::getId).collect(Collectors.toList());
        Map<Long, String> primaryUrls = displayPhotoRepository.findPrimaryByDisplayIdIn(ids).stream()
            .collect(Collectors.toMap(p -> p.getDisplay().getId(), DisplayPhoto::getUrl));
        return displays.stream()
            .map(d -> buildSummary(d, primaryUrls.get(d.getId())))
            .collect(Collectors.toList());
    }

    private DisplaySummaryResponse buildSummary(Display display, String primaryPhotoUrl) {
        return DisplaySummaryResponse.builder()
            .id(display.getId())
            .title(display.getTitle())
            .city(display.getCity())
            .state(display.getState())
            .lat(display.getLocation().getY())
            .lng(display.getLocation().getX())
            .upvoteCount(display.getUpvoteCount())
            .photoCount(display.getPhotoCount())
            .displayType(display.getDisplayType().name())
            .primaryPhotoUrl(primaryPhotoUrl)
            .tags(display.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
            .isActive(display.isActive())
            .build();
    }

    private DisplaySummaryResponse mapRowToSummary(Object[] row) {
        return DisplaySummaryResponse.builder()
            .id(((Number) row[0]).longValue())
            .title((String) row[1])
            .city((String) row[2])
            .state((String) row[3])
            .lat(((Number) row[4]).doubleValue())
            .lng(((Number) row[5]).doubleValue())
            .upvoteCount(((Number) row[6]).intValue())
            .photoCount(((Number) row[7]).intValue())
            .displayType((String) row[8])
            .primaryPhotoUrl((String) row[10])
            .tags(List.of())
            .build();
    }
}
