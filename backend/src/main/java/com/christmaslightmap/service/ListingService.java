package com.christmaslightmap.service;

import com.christmaslightmap.dto.response.ListingResponse;
import com.christmaslightmap.dto.response.ListingSummaryResponse;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.dto.response.TagResponse;
import com.christmaslightmap.dto.request.CreateListingRequest;
import com.christmaslightmap.dto.request.SetListingActiveRequest;
import com.christmaslightmap.dto.request.UpdateListingRequest;
import com.christmaslightmap.model.Category;
import com.christmaslightmap.model.DisplayPhoto;
import com.christmaslightmap.model.Host;
import com.christmaslightmap.model.Listing;
import com.christmaslightmap.model.User;
import com.christmaslightmap.repository.DisplayPhotoRepository;
import com.christmaslightmap.repository.HostRepository;
import com.christmaslightmap.repository.ListingRepository;
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
public class ListingService {

    private static final GeometryFactory GEOMETRY_FACTORY =
        new GeometryFactory(new PrecisionModel(), 4326);

    private final ListingRepository listingRepository;
    private final UserRepository userRepository;
    private final TagRepository tagRepository;
    private final DisplayPhotoRepository displayPhotoRepository;
    private final UpvoteRepository upvoteRepository;
    private final HostRepository hostRepository;

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
        Host host;
        if (request.getHostId() != null) {
            host = hostRepository.findById(request.getHostId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Host not found"));
            if (!host.getOwner().getId().equals(userId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your host");
            }
        } else {
            host = findOrCreateDefaultHost(userId);
        }

        Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(request.getLng(), request.getLat()));
        location.setSRID(4326);

        var tags = new HashSet<>(tagRepository.findAllById(
            request.getTagIds() != null ? request.getTagIds() : List.of()));

        Listing listing = listingRepository.save(Listing.builder()
            .host(host)
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
            .hostName(host.getDisplayName())
            .tags(tags)
            .build());

        return ListingResponse.from(listing, List.of());
    }

    @Transactional
    public ListingResponse adminUpdateListing(Long listingId, UpdateListingRequest request) {
        Listing listing = listingRepository.findById(listingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));

        Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(request.getLng(), request.getLat()));
        location.setSRID(4326);

        var tags = new HashSet<>(tagRepository.findAllById(
            request.getTagIds() != null ? request.getTagIds() : List.of()));

        listing.setTitle(request.getTitle());
        listing.setDescription(request.getDescription());
        listing.setAddress(request.getAddress());
        listing.setCity(request.getCity());
        listing.setState(request.getState());
        listing.setPostcode(request.getPostcode());
        listing.setLocation(location);
        listing.setCategory(request.getCategory());
        listing.setStartDatetime(request.getStartDatetime());
        listing.setEndDatetime(request.getEndDatetime());
        listing.setBestTime(request.getBestTime());
        listing.setDisplayType(request.getDisplayType());
        listing.setCuisineType(request.getCuisineType());
        listing.setOrganizer(request.getOrganizer());
        listing.setWebsiteUrl(request.getWebsiteUrl());
        listing.setPriceInfo(request.getPriceInfo());
        listing.setHostName(request.getHostName() != null && !request.getHostName().isBlank()
            ? request.getHostName().trim().substring(0, Math.min(request.getHostName().trim().length(), 100))
            : null);
        listing.setTags(tags);

        listing = listingRepository.save(listing);
        return ListingResponse.from(listing, displayPhotoRepository.findByDisplay_Id(listingId));
    }

    @Transactional
    public void deleteListing(Long userId, Long listingId) {
        Listing listing = listingRepository.findById(listingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        if (listing.getHost() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
        }
        if (!listing.getHost().getOwner().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
        }
        listingRepository.delete(listing);
    }

    @Transactional
    public ListingSummaryResponse setListingActive(Long userId, Long listingId, SetListingActiveRequest request) {
        Listing listing = listingRepository.findById(listingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        if (listing.getHost() == null || !listing.getHost().getOwner().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
        }
        listing.setActive(request.isActive());
        listing = listingRepository.save(listing);

        String primaryUrl = displayPhotoRepository.findPrimaryByDisplayIdIn(List.of(listingId))
            .stream().findFirst().map(DisplayPhoto::getUrl).orElse(null);

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
            .primaryPhotoUrl(primaryUrl)
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

    @Transactional
    public ListingResponse updateListing(Long userId, Long listingId, UpdateListingRequest request) {
        Listing listing = listingRepository.findById(listingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        if (listing.getHost() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
        }
        boolean isOwner = listing.getHost().getOwner().getId().equals(userId);
        if (!isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
        }
        if (!listing.isActive()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found");
        }

        if (request.getHostId() != null) {
            Host host = hostRepository.findById(request.getHostId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Host not found"));
            if (!host.getOwner().getId().equals(userId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your host");
            }
            listing.setHost(host);
            listing.setHostName(host.getDisplayName());
        }

        Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(request.getLng(), request.getLat()));
        location.setSRID(4326);

        var tags = new HashSet<>(tagRepository.findAllById(
            request.getTagIds() != null ? request.getTagIds() : List.of()));

        listing.setTitle(request.getTitle());
        listing.setDescription(request.getDescription());
        listing.setAddress(request.getAddress());
        listing.setCity(request.getCity());
        listing.setState(request.getState());
        listing.setPostcode(request.getPostcode());
        listing.setLocation(location);
        listing.setCategory(request.getCategory());
        listing.setStartDatetime(request.getStartDatetime());
        listing.setEndDatetime(request.getEndDatetime());
        listing.setBestTime(request.getBestTime());
        listing.setDisplayType(request.getDisplayType());
        listing.setCuisineType(request.getCuisineType());
        listing.setOrganizer(request.getOrganizer());
        listing.setWebsiteUrl(request.getWebsiteUrl());
        listing.setPriceInfo(request.getPriceInfo());
        if (request.getHostId() == null) {
            listing.setHostName(request.getHostName() != null && !request.getHostName().isBlank()
                ? request.getHostName().trim().substring(0, Math.min(request.getHostName().trim().length(), 100))
                : null);
        }
        listing.setTags(tags);

        listing = listingRepository.save(listing);
        return ListingResponse.from(listing, displayPhotoRepository.findByDisplay_Id(listingId));
    }

    @Transactional
    public void deletePhoto(Long userId, Long listingId, Long photoId) {
        Listing listing = listingRepository.findById(listingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        if (listing.getHost() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
        }
        boolean isOwner = listing.getHost().getOwner().getId().equals(userId);
        if (!isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
        }
        if (!listing.isActive()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found");
        }

        DisplayPhoto photo = displayPhotoRepository.findById(photoId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found"));

        if (!photo.getDisplay().getId().equals(listingId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found");
        }

        boolean wasPrimary = photo.isPrimary();
        displayPhotoRepository.delete(photo);

        if (wasPrimary) {
            List<DisplayPhoto> remaining = displayPhotoRepository.findByDisplay_Id(listingId);
            if (!remaining.isEmpty()) {
                remaining.get(0).setPrimary(true);
                displayPhotoRepository.save(remaining.get(0));
            }
        }
    }

    public List<ListingSummaryResponse> getUpvotedListings(Long userId) {
        List<Listing> listings = upvoteRepository.findByUserIdWithActiveListings(userId).stream()
            .map(u -> u.getListing())
            .collect(Collectors.toList());
        return toSummaries(listings);
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
        String resolvedHostName = listing.getHost().getDisplayName();
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
            .resolvedHostName(resolvedHostName)
            .build();
    }

    private ListingSummaryResponse mapRowToSummary(Object[] row) {
        String categoryStr = (String) row[11];
        String resolvedHostName = (String) row[18];
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
            .primaryPhotoUrl((String) row[10])
            .category(categoryStr != null ? Category.valueOf(categoryStr) : null)
            .startDatetime(row[12] != null ? ((java.sql.Timestamp) row[12]).toLocalDateTime() : null)
            .endDatetime(row[13] != null ? ((java.sql.Timestamp) row[13]).toLocalDateTime() : null)
            .priceInfo((String) row[14])
            .cuisineType((String) row[15])
            .organizer((String) row[16])
            .websiteUrl((String) row[17])
            .resolvedHostName(resolvedHostName)
            .tags(List.of())
            .build();
    }

    private Host findOrCreateDefaultHost(Long userId) {
        return hostRepository.findByOwner_IdAndIsDefaultTrue(userId)
            .orElseGet(() -> {
                User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
                String displayName = (user.getDisplayName() != null && !user.getDisplayName().isBlank())
                    ? user.getDisplayName() : user.getName();
                String handle = generateHandle(displayName, userId);
                return hostRepository.save(Host.builder()
                    .owner(user)
                    .handle(handle)
                    .displayName(displayName)
                    .isDefault(true)
                    .build());
            });
    }

    private String generateHandle(String displayName, Long userId) {
        String base = displayName.toLowerCase().replaceAll("[^a-z0-9]", "");
        base = base.isEmpty() ? "user" + userId : base.substring(0, Math.min(base.length(), 20));
        String handle = base;
        int suffix = 1;
        while (hostRepository.existsByHandle(handle) || userRepository.existsByHandle(handle)) {
            handle = base + suffix++;
        }
        return handle;
    }
}
