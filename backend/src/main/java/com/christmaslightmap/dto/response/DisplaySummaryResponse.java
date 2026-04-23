package com.christmaslightmap.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class DisplaySummaryResponse {
    private Long id;
    private String title;
    private String city;
    private String state;
    private double lat;
    private double lng;
    private int upvoteCount;
    private int photoCount;
    private String displayType;
    private String primaryPhotoUrl;
    private List<TagResponse> tags;
    private boolean isActive;
}
