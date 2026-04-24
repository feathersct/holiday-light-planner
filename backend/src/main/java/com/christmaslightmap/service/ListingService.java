package com.christmaslightmap.service;

import com.christmaslightmap.dto.response.ListingResponse;
import com.christmaslightmap.dto.response.ListingSummaryResponse;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.dto.response.TagResponse;
import com.christmaslightmap.dto.request.CreateListingRequest;
import com.christmaslightmap.model.Category;
import com.christmaslightmap.model.DisplayPhoto;
import com.christmaslightmap.model.Listing;
import com.christmaslightmap.repository.DisplayPhotoRepository;
import com.christmaslightmap.repository.ListingRepository;
import com.christmaslightmap.repository.TagRepository;
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
public class ListingService {

    private static final GeometryFactory GEOMETRY_FACTORY =
        new GeometryFactory(new PrecisionModel(), 4326);

    private final ListingRepository listingRepository;
    private final UserRepository userRepository;
    private final TagRepository tagRepository;
    private final DisplayPhotoRepository displayPhotoRepository;

    public PagedResponse<ListingSummaryResponse> searchListings(
            double lat, double lng, double radiusMiles,
            List<Long> tagIds, String category, boolean includeExpired, int page, int size) {

        double radiusMetres = radiusMiles * 1609.34;
        int offset = page * size;
        String categoryStr = (category != null && !category.isBlank()) ? category : null;

        List<Object[]> rows;
        long total;
        if (tagIds == null || tagIds.isEmpty()) {
            rows = listingRepository.searchListings(lat, lng, radiusMetres, categoryStr, includeExpired, size, offset);
            total = listingRepository.countSearchListings(lat, lng, radiusMetres, categoryStr, includeExpired);
        } else {
            rows = listingRepository.searchListingsWithTags(lat, lng, radiusMetres, categoryStr, includeExpired, tagIds, size, offset);
            total = listingRepository.countSearchListingsWithTags(lat, lng, radiusMetres, categoryStr, includeExpired, tagIds);
        }

        List<ListingSummaryResponse> summaries = rows.stream()
            .map(this::mapRowToSummary)
            .collect(Collectors.toList());

        if (!summaries.isEmpty()) {
            List<Long> ids = summaries.stream().map(ListingSummaryResponse::getId).collect(Collectors.toList());
            List<Listing> withTags = listingRepository.findByIdInWithTags(ids);
            Map<Long, List<TagResponse>> tagMap = withTags.stream().collect(Collectors.toMap(
                Listing::getId,
                d -> d.getTags().stream().map(TagResponse::from).collect(Collectors.toList())
            ));
            summaries.forEach(s -> s.setTags(tagMap.getOrDefault(s.getId(), List.of())));
        }

        return PagedResponse.<ListingSummaryResponse>builder()
            .content(summaries)
            .page(page)
            .size(size)
            .totalElements(total)
            .totalPages(total == 0 ? 0 : (int) Math.ceil((double) total / size))
            .last((long) (offset + size) >= total)
            .build();
    }

    public ListingResponse getById(Long id) {
        Listing listing = listingRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        return ListingResponse.from(listing, displayPhotoRepository.findByDisplay_Id(id));
    }

    @Transactional
    public ListingResponse createListing(Long userId, CreateListingRequest request) {
        var user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(request.getLng(), request.getLat()));
        location.setSRID(4326);

        var tags = new HashSet<>(tagRepository.findAllById(
            request.getTagIds() != null ? request.getTagIds() : List.of()));

        Listing listing = listingRepository.save(Listing.builder()
            .user(user)
            .title(request.getTitle())
            .description(request.getDescription())
            .address(request.getAddress())
            .city(request.getCity())
            .state(request.getState())
            .postcode(request.getPostcode())
            .location(location)
            .category(request.getCategory())
            .startDatetime(request.getStartDatetime())
            .endDatetime(request.getEndDatetime())
            .bestTime(request.getBestTime())
            .displayType(request.getDisplayType())
            .cuisineType(request.getCuisineType())
            .organizer(request.getOrganizer())
            .websiteUrl(request.getWebsiteUrl())
            .priceInfo(request.getPriceInfo())
            .tags(tags)
            .build());

        return ListingResponse.from(listing, List.of());
    }

    @Transactional
    public void deleteListing(Long userId, Long listingId) {
        Listing listing = listingRepository.findById(listingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        if (!listing.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
        }
        listing.setActive(false);
        listingRepository.save(listing);
    }

    public List<ListingSummaryResponse> getMyListings(Long userId) {
        List<Listing> listings = listingRepository.findByUserIdAndIsActiveTrue(userId);
        return toSummaries(listings);
    }

    public List<ListingSummaryResponse> getUpvotedListings(Long userId) {
        // upvote.display is still Display type; Task 8 changes it to Listing
        // This method will work correctly after Task 8 completes
        return List.of();
    }

    private List<ListingSummaryResponse> toSummaries(List<Listing> listings) {
        if (listings.isEmpty()) return List.of();
        List<Long> ids = listings.stream().map(Listing::getId).collect(Collectors.toList());
        Map<Long, String> primaryUrls = displayPhotoRepository.findPrimaryByDisplayIdIn(ids).stream()
            .collect(Collectors.toMap(p -> p.getDisplay().getId(), DisplayPhoto::getUrl));
        return listings.stream()
            .map(d -> buildSummary(d, primaryUrls.get(d.getId())))
            .collect(Collectors.toList());
    }

    private ListingSummaryResponse buildSummary(Listing listing, String primaryPhotoUrl) {
        return ListingSummaryResponse.builder()
            .id(listing.getId())
            .title(listing.getTitle())
            .city(listing.getCity())
            .state(listing.getState())
            .lat(listing.getLocation().getY())
            .lng(listing.getLocation().getX())
            .upvoteCount(listing.getUpvoteCount())
            .photoCount(listing.getPhotoCount())
            .category(listing.getCategory())
            .displayType(listing.getDisplayType() != null ? listing.getDisplayType().name() : null)
            .primaryPhotoUrl(primaryPhotoUrl)
            .tags(listing.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
            .isActive(listing.isActive())
            .startDatetime(listing.getStartDatetime())
            .endDatetime(listing.getEndDatetime())
            .priceInfo(listing.getPriceInfo())
            .cuisineType(listing.getCuisineType())
            .organizer(listing.getOrganizer())
            .websiteUrl(listing.getWebsiteUrl())
            .build();
    }

    private ListingSummaryResponse mapRowToSummary(Object[] row) {
        String categoryStr = (String) row[11];
        return ListingSummaryResponse.builder()
            .id(((Number) row[0]).longValue())
            .title((String) row[1])
            .city((String) row[2])
            .state((String) row[3])
            .lat(((Number) row[4]).doubleValue())
            .lng(((Number) row[5]).doubleValue())
            .upvoteCount(((Number) row[6]).intValue())
            .photoCount(((Number) row[7]).intValue())
            .displayType((String) row[8])
            // row[9] is created_at — not included in summary DTO
            .primaryPhotoUrl((String) row[10])
            .category(categoryStr != null ? Category.valueOf(categoryStr) : null)
            .startDatetime(row[12] != null ? ((java.sql.Timestamp) row[12]).toLocalDateTime() : null)
            .endDatetime(row[13] != null ? ((java.sql.Timestamp) row[13]).toLocalDateTime() : null)
            .priceInfo((String) row[14])
            .cuisineType((String) row[15])
            .organizer((String) row[16])
            .websiteUrl((String) row[17])
            .tags(List.of())
            .build();
    }
}
