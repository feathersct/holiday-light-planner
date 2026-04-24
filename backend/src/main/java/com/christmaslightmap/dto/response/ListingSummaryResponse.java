package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.Category;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class ListingSummaryResponse {
    private Long id;
    private String title;
    private String city;
    private String state;
    private double lat;
    private double lng;
    private int upvoteCount;
    private int photoCount;
    private Category category;
    private String displayType;
    private String primaryPhotoUrl;
    private List<TagResponse> tags;
    private boolean isActive;
    private LocalDateTime startDatetime;
    private LocalDateTime endDatetime;
    private String priceInfo;
    private String cuisineType;
    private String organizer;
    private String websiteUrl;
}
