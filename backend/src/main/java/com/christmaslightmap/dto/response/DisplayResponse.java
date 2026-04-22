package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.Display;
import com.christmaslightmap.model.DisplayPhoto;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
public class DisplayResponse {
    private Long id;
    private Long submittedBy;
    private String title;
    private String description;
    private String address;
    private String city;
    private String state;
    private String postcode;
    private double lat;
    private double lng;
    private String bestTime;
    private String displayType;
    private int upvoteCount;
    private int photoCount;
    private boolean isActive;
    private LocalDateTime createdAt;
    private List<TagResponse> tags;
    private List<PhotoResponse> photos;

    public static DisplayResponse from(Display display, List<DisplayPhoto> photos) {
        return DisplayResponse.builder()
            .id(display.getId())
            .submittedBy(display.getUser().getId())
            .title(display.getTitle())
            .description(display.getDescription())
            .address(display.getAddress())
            .city(display.getCity())
            .state(display.getState())
            .postcode(display.getPostcode())
            .lat(display.getLocation().getY())
            .lng(display.getLocation().getX())
            .bestTime(display.getBestTime())
            .displayType(display.getDisplayType().name())
            .upvoteCount(display.getUpvoteCount())
            .photoCount(display.getPhotoCount())
            .isActive(display.isActive())
            .createdAt(display.getCreatedAt())
            .tags(display.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
            .photos(photos.stream().map(PhotoResponse::from).collect(Collectors.toList()))
            .build();
    }
}
