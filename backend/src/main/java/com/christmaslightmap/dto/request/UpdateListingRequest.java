package com.christmaslightmap.dto.request;

import com.christmaslightmap.model.Category;
import com.christmaslightmap.model.DisplayType;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class UpdateListingRequest {
    private Category category;
    private String title;
    private String description;
    private String address;
    private String city;
    private String state;
    private String postcode;
    private double lat;
    private double lng;
    private LocalDateTime startDatetime;
    private LocalDateTime endDatetime;
    private String priceInfo;
    private String bestTime;
    private DisplayType displayType;
    private List<Long> tagIds;
    private String cuisineType;
    private String organizer;
    private String websiteUrl;
    private String hostName;
    private Long hostId;
}
