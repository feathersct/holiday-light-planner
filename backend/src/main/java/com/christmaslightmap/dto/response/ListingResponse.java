package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.Category;
import com.christmaslightmap.model.Listing;
import com.christmaslightmap.model.DisplayPhoto;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
public class ListingResponse {
    private Long id;
    private Long submittedBy;
    private String submittedByName;
    private String submittedByAvatarUrl;
    private String submittedByHandle;
    private String title;
    private String description;
    private String address;
    private String city;
    private String state;
    private String postcode;
    private double lat;
    private double lng;
    private Category category;
    private LocalDateTime startDatetime;
    private LocalDateTime endDatetime;
    private String bestTime;
    private String displayType;
    private String cuisineType;
    private String organizer;
    private String websiteUrl;
    private String resolvedHostName;
    private Long hostId;
    private String hostHandle;
    private String priceInfo;
    private int upvoteCount;
    private int photoCount;
    private boolean isActive;
    private LocalDateTime createdAt;
    private List<TagResponse> tags;
    private List<PhotoResponse> photos;

    public static ListingResponse from(Listing listing, List<DisplayPhoto> photos) {
        return ListingResponse.builder()
            .id(listing.getId())
            .submittedBy(listing.getUser().getId())
            .submittedByName(resolveHostName(listing))
            .submittedByAvatarUrl(listing.getUser().getAvatarUrl())
            .submittedByHandle(listing.getUser().getHandle())
            .title(listing.getTitle())
            .description(listing.getDescription())
            .address(listing.getAddress())
            .city(listing.getCity())
            .state(listing.getState())
            .postcode(listing.getPostcode())
            .lat(listing.getLocation().getY())
            .lng(listing.getLocation().getX())
            .category(listing.getCategory())
            .startDatetime(listing.getStartDatetime())
            .endDatetime(listing.getEndDatetime())
            .bestTime(listing.getBestTime())
            .displayType(listing.getDisplayType() != null ? listing.getDisplayType().name() : null)
            .cuisineType(listing.getCuisineType())
            .organizer(listing.getOrganizer())
            .websiteUrl(listing.getWebsiteUrl())
            .resolvedHostName(resolveHostName(listing))
            .hostId(listing.getHost() != null ? listing.getHost().getId() : null)
            .hostHandle(listing.getHost() != null ? listing.getHost().getHandle() : null)
            .priceInfo(listing.getPriceInfo())
            .upvoteCount(listing.getUpvoteCount())
            .photoCount(listing.getPhotoCount())
            .isActive(listing.isActive())
            .createdAt(listing.getCreatedAt())
            .tags(listing.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
            .photos(photos.stream().map(PhotoResponse::from).collect(Collectors.toList()))
            .build();
    }

    private static String resolveHostName(Listing listing) {
        if (listing.getHost() != null) return listing.getHost().getDisplayName();
        if (listing.getHostName() != null && !listing.getHostName().isBlank()) return listing.getHostName();
        if (listing.getUser().getDisplayName() != null && !listing.getUser().getDisplayName().isBlank()) return listing.getUser().getDisplayName();
        return listing.getUser().getName();
    }
}
